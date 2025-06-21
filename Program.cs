using System.Globalization;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using CsvHelper;
using CsvHelper.Configuration;
using EFacture.API.Data;
using EFacture.API.Models;
using EFacture.API.Services;
using EFacture.API.Validators;
using FluentValidation;
using FluentValidation.AspNetCore;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Minio;
using Minio.DataModel.Args;
using QuestPDF;
using QuestPDF.Infrastructure;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

Settings.License = LicenseType.Community;

Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Debug()
    .WriteTo.Console()
    .WriteTo.File("Logs/log-.txt", rollingInterval: RollingInterval.Day)
    .CreateLogger();

builder.Host.UseSerilog();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReactDev", policy =>
    {
        policy
            .WithOrigins("http://localhost:3000")
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

builder.Services.AddFluentValidationAutoValidation();
builder.Services.AddFluentValidationClientsideAdapters();
builder.Services.AddValidatorsFromAssemblyContaining<InvoiceValidator>();

builder.Services.AddDbContext<EFactureDbContext>(options => options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddControllers().AddJsonOptions(opts =>
{
    opts.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
});

builder.Services.AddIdentity<ApplicationUser, IdentityRole>(options =>
    {
        options.Password.RequireDigit = false;
        options.Password.RequiredLength = 6;
        options.Password.RequireNonAlphanumeric = false;
        options.Password.RequireUppercase = false;
    })
    .AddEntityFrameworkStores<EFactureDbContext>()
    .AddDefaultTokenProviders();

{
    var jwtKey = builder.Configuration["Jwt:Key"]!;
    var jwtIssuer = builder.Configuration["Jwt:Issuer"];
    var jwtAudience = builder.Configuration["Jwt:Audience"];
    builder.Services.AddAuthentication(options =>
        {
            options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
            options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
        })
        .AddJwtBearer(options =>
        {
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),

                ValidateIssuer = true,
                ValidIssuer = jwtIssuer,

                ValidateAudience = true,
                ValidAudience = jwtAudience,

                ValidateLifetime = true,
                ClockSkew = TimeSpan.FromMinutes(2)
            };
        });
}

//builder.Services.AddAuthorization();
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("AdminOrManager", policy => policy.RequireRole("Admin", "Manager"));
    options.AddPolicy("Admin", policy => policy.RequireRole("Admin"));
});


builder.Services.AddEndpointsApiExplorer();

builder.Services.AddScoped<InvoicePdfService>();
builder.Services.AddScoped<CsvImportService>();


var app = builder.Build();


app.UseSerilogRequestLogging();

app.UseExceptionHandler(errorApp =>
{
    errorApp.Run(async context =>
    {
        var errorFeature = context.Features.Get<Microsoft.AspNetCore.Diagnostics.IExceptionHandlerFeature>();
        var exception = errorFeature?.Error;

        // 1. Log the exception
        Log.Error(exception, "Unhandled exception");

        // 2. Return a generic 500 ProblemDetails payload
        context.Response.StatusCode = StatusCodes.Status500InternalServerError;
        context.Response.ContentType = "application/json";
        var problem = new ProblemDetails
        {
            Status = StatusCodes.Status500InternalServerError,
            Title = "An unexpected error occurred."
        };
        await context.Response.WriteAsJsonAsync(problem);
    });
});

//app.UseRouting();
app.UseCors("AllowReactDev");

app.UseAuthentication();
app.UseAuthorization();


using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<EFactureDbContext>();
    db.Database.Migrate();

    var roleMgr = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();
    foreach (var roleName in new[] { "Clerk", "Manager", "Admin" })
    {
        if (!await roleMgr.RoleExistsAsync(roleName)) await roleMgr.CreateAsync(new IdentityRole(roleName));
    }
}


#region Endpoints

app.MapGet("/", () => "E-Facture API running ✅");

app.MapGet("/api/invoices", async (EFactureDbContext db, ClaimsPrincipal user) =>
{
    var cid = GetCompanyId(user);
    return await db.Invoices
        .Where(i => i.CompanyId == cid)
        .Include(i => i.Lines)
        .Include(i => i.CreatedBy)
        .Select(i => new
        {
            i.Id,
            i.InvoiceNumber,
            i.Date,
            i.CustomerName,
            i.SubTotal,
            i.VAT,
            i.Total,
            i.Status,
            i.Lines,
            i.CreatedAt,
            CreatedBy = new
            {
                i.CreatedById,
                Name = i.CreatedBy!.UserName,
                Email = i.CreatedBy.Email
            }
        })
        .ToListAsync();
})
    .RequireAuthorization();

app.MapGet("/api/invoices/{id:int}", async (int id, EFactureDbContext db, ClaimsPrincipal user) =>
{
    var cid = GetCompanyId(user);
    var invoice = await db.Invoices
        .Include(i => i.Lines)
        .FirstOrDefaultAsync(i => i.Id == id && i.CompanyId == cid);


    if (invoice is null) return Results.NotFound();

    var history = await db.InvoiceStatusHistories
        .Where(h => h.InvoiceId == id)
        .OrderBy(h => h.ChangedAt)
        .Select(h => new {
            h.OldStatus,
            h.NewStatus,
            h.ChangedBy,
            h.ChangedAt
        })
        .ToListAsync();
    return Results.Ok(new
    {
        Invoice = invoice,
        StatusHistory = history
    });
})
    .RequireAuthorization();

app.MapPost("/api/invoices", async (Invoice newInvoice, EFactureDbContext db, InvoicePdfService pdfService, ClaimsPrincipal user) =>
{
    var cid = GetCompanyId(user);
    newInvoice.Status = InvoiceStatus.Draft;

    var uid = GetUid(user)!;

    newInvoice.CreatedById = uid;
    newInvoice.CreatedAt = DateTime.UtcNow;
    newInvoice.UpdatedAt = DateTime.UtcNow;
    newInvoice.CompanyId = cid;
    db.Invoices.Add(newInvoice);
    await db.SaveChangesAsync();


    db.InvoiceStatusHistories.Add(new InvoiceStatusHistory
    {
        InvoiceId = newInvoice.Id,
        OldStatus = InvoiceStatus.Draft,
        NewStatus = InvoiceStatus.Draft,
        ChangedBy = uid,
        ChangedAt = DateTime.UtcNow
    });
    await db.SaveChangesAsync();


    var pdfBytes = await pdfService.GeneratePdfAsync(newInvoice.Id);
    if(pdfBytes != null) await pdfService.UploadPdfToMinioAsync(newInvoice.Id, pdfBytes);
    return Results.Created($"/api/invoices/{newInvoice.Id}", newInvoice);
})
    .AddEndpointFilter<ValidationFilter<Invoice>>()
    .RequireAuthorization();

app.MapPut("/api/invoices/{id:int}", async (int id, Invoice updated, EFactureDbContext db, InvoicePdfService pdfService, ClaimsPrincipal user) =>
{
    var cid = GetCompanyId(user);
    var existingInvoice = await db.Invoices
        .Include(i => i.Lines)
        .FirstOrDefaultAsync(i =>
            i.Id == id &&
            i.CompanyId == cid
        );

    if (existingInvoice is null)
        return Results.NotFound();

    var oldStatus = existingInvoice.Status;

    if (oldStatus == InvoiceStatus.Submitted) return Results.BadRequest("Cannot modify a submitted invoice.");

    if (oldStatus == InvoiceStatus.Draft && updated.Status == InvoiceStatus.Ready)
    {
        var errors = ValidateInvoice(updated, db);
        if (errors.Any()) return Results.BadRequest(new { Errors = errors });
    }

    var isClerk = user.IsInRole("Clerk");
    var isManager = user.IsInRole("Manager");
    var isAdmin = user.IsInRole("Admin");

    if (updated.Status != existingInvoice.Status)
    {
        if (isClerk) return Results.Forbid();

        if (isManager && !(existingInvoice.Status == InvoiceStatus.Draft && updated.Status == InvoiceStatus.Ready)) return Results.Forbid();

        if (isAdmin && !((existingInvoice.Status == InvoiceStatus.Draft && updated.Status == InvoiceStatus.Ready) || (existingInvoice.Status == InvoiceStatus.Ready && updated.Status == InvoiceStatus.Submitted))) return Results.Forbid();

        if (!(isClerk || isManager || isAdmin)) return Results.Forbid();
    }

    existingInvoice.InvoiceNumber = updated.InvoiceNumber;
    existingInvoice.Date = updated.Date;
    existingInvoice.CustomerName = updated.CustomerName;
    existingInvoice.Status = updated.Status;
    //existingInvoice.SubTotal = updated.SubTotal;
    existingInvoice.VAT = updated.VAT;
    //existingInvoice.Total = updated.Total;

    existingInvoice.SubTotal = existingInvoice.Lines.Sum(l => l.Quantity * l.UnitPrice);
    //existingInvoice.VAT = Math.Round(existingInvoice.SubTotal * 0.2m, 2);
    existingInvoice.Total = existingInvoice.SubTotal + existingInvoice.VAT;

    if (existingInvoice.Lines.Any())
    {
        db.InvoiceLines.RemoveRange(existingInvoice.Lines);
        existingInvoice.Lines.Clear();
    }
    foreach (var incomingLine in updated.Lines)
    {
        var newLine = new InvoiceLine
        {
            Description = incomingLine.Description,
            Quantity = incomingLine.Quantity,
            UnitPrice = incomingLine.UnitPrice
        };
        existingInvoice.Lines.Add(newLine);
    }


    var uid = GetUid(user)!;
    db.InvoiceStatusHistories.Add(new InvoiceStatusHistory
    {
        InvoiceId = existingInvoice.Id,
        OldStatus = oldStatus,
        NewStatus = updated.Status,
        ChangedBy = uid,
        ChangedAt = DateTime.UtcNow
    });

    existingInvoice.UpdatedAt = DateTime.UtcNow;

    await db.SaveChangesAsync();
    var pdfBytes = await pdfService.GeneratePdfAsync(existingInvoice.Id);
    if (pdfBytes != null) await pdfService.UploadPdfToMinioAsync(existingInvoice.Id, pdfBytes);
    return Results.NoContent();
})
    .AddEndpointFilter<ValidationFilter<Invoice>>()
    .RequireAuthorization();


app.MapDelete("/api/invoices/{id:int}", async (int id, EFactureDbContext db, ClaimsPrincipal user) =>
{
    var cid = GetCompanyId(user);
    var invoice = await db.Invoices.FirstOrDefaultAsync(i =>
        i.Id == id &&
        i.CompanyId == cid
    );
    if (invoice is null) return Results.NotFound();

    db.Invoices.Remove(invoice);
    await db.SaveChangesAsync();
    return Results.NoContent();
})
    .RequireAuthorization();

app.MapPost("/api/invoices/import-csv", async (HttpRequest req, CsvImportService csvService, EFactureDbContext db, InvoicePdfService pdfService, ClaimsPrincipal user) =>
{
    if (!req.HasFormContentType)
        return Results.BadRequest("Content-type must be multipart/form-data");

    var form = await req.ReadFormAsync();
    var file = form.Files.GetFile("file");
    if (file is null || file.Length == 0)
        return Results.BadRequest("No file uploaded");

    var validation = csvService.ValidateFile(file);
    if (!validation.IsValid) return Results.BadRequest(new { validation.Errors });


    // 1. Read CSV into records
    using var reader = new StreamReader(file.OpenReadStream());
    // peek header line to detect delimiter
    var peek = reader.ReadLine()!;
    var delimiter = peek.Contains(';') ? ';' : ',';
    // rewind to start
    reader.BaseStream.Seek(0, SeekOrigin.Begin);
    reader.DiscardBufferedData();

    var config = new CsvConfiguration(CultureInfo.InvariantCulture)
    {
        HasHeaderRecord = true,
        Delimiter = delimiter.ToString()
    };
    using var csv = new CsvReader(reader, config);
    var records = csv.GetRecords<InvoiceCsvRecord>().ToList();

    if (!records.Any())
        return Results.BadRequest("CSV is empty");

    var rowResults = csvService.ValidateRows(records);
    if (rowResults.Any(r => !r.IsValid))
        return Results.BadRequest(new
        {
            RowErrors = rowResults
                .Where(r => !r.IsValid)
                .Select(r => new { r.RowNumber, r.Errors })
        });


    var uid = GetUid(user)!;
    var cid = GetCompanyId(user);
    var createdInvoices = new List<Invoice>();
    // 2. Group by InvoiceNumber to build Invoice + Lines
    var grouped = records.GroupBy(r => r.InvoiceNumber);
    foreach (var group in grouped)
    {
        var first = group.First();
        var invoice = new Invoice
        {
            InvoiceNumber = first.InvoiceNumber,
            Date = first.Date,
            CustomerName = first.CustomerName,
            Lines = group.Select(r => new InvoiceLine
            {
                Description = r.Description,
                Quantity = r.Quantity,
                UnitPrice = r.UnitPrice
            }).ToList(),
            CompanyId = cid,
            CreatedById = uid,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        invoice.SubTotal = invoice.Lines.Sum(l => l.Quantity * l.UnitPrice);
        invoice.VAT = Math.Round(invoice.SubTotal * 0.2m, 2);
        invoice.Total = invoice.SubTotal + invoice.VAT;

        db.Invoices.Add(invoice);
        createdInvoices.Add(invoice);
    }

    await db.SaveChangesAsync();
    foreach (var invoice in createdInvoices)
    {
        var pdfBytes = await pdfService.GeneratePdfAsync(invoice.Id);
        if (pdfBytes != null) await pdfService.UploadPdfToMinioAsync(invoice.Id, pdfBytes);
    }
    return Results.Ok(new { Message = "Imported successfully", records.Count });
})
    .RequireAuthorization();

app.MapGet("/api/invoices/{id:int}/pdf-url", async (int id, EFactureDbContext db, IConfiguration config, ClaimsPrincipal user) =>
{
    var cid = GetCompanyId(user);

    // ensure the invoice belongs to this user
    var exists = await db.Invoices
        .AnyAsync(i => i.Id == id && i.CompanyId == cid);
    if (!exists)
        return Results.NotFound($"Invoice {id} not found for this user.");


    var minio = new MinioClient()
        .WithEndpoint(config["Minio:Endpoint"]!)
        .WithCredentials(config["Minio:AccessKey"]!, config["Minio:SecretKey"]!)
        .Build();

    var bucket = config["Minio:BucketName"]!;
    var objectName = $"invoices/{id}.pdf";

    try
    {
        // Generate a presigned GET URL (valid for 60 seconds)
        var url = await minio.PresignedGetObjectAsync(
            new PresignedGetObjectArgs()
                .WithBucket(bucket)
                .WithObject(objectName)
                .WithExpiry(60)
        );
        return Results.Ok(new { url });
    }
    catch (Exception)
    {
        return Results.NotFound($"PDF for invoice {id} not found.");
    }
})
    .RequireAuthorization();

app.MapPost("/api/invoices/{id:int}/submit", async (int id, EFactureDbContext db, ClaimsPrincipal user) =>
{
    if (!user.IsInRole("Admin")) return Results.Forbid();

    var cid = GetCompanyId(user);
    var invoice = await db.Invoices.FirstOrDefaultAsync(i =>
        i.Id == id &&
        i.CompanyId == cid
    );
    if (invoice is null) return Results.NotFound();
    if (invoice.Status != InvoiceStatus.Ready) return Results.BadRequest("Only Ready invoices can be submitted.");



    var oldStatus = invoice.Status;
    invoice.Status = InvoiceStatus.Submitted;
    var uid = GetUid(user)!;
    db.InvoiceStatusHistories.Add(new InvoiceStatusHistory
    {
        InvoiceId = invoice.Id,
        OldStatus = oldStatus,
        NewStatus = InvoiceStatus.Submitted,
        ChangedBy = uid,
        ChangedAt = DateTime.UtcNow
    });

    await db.SaveChangesAsync();
    return Results.Ok(invoice);
})
    .RequireAuthorization();

//--------Auth

app.MapPost("/api/auth/register", async (EFactureDbContext db, UserManager<ApplicationUser> userMgr, RoleManager<IdentityRole> roleMgr, RegisterModel model) =>
{
    if (await db.Companies.AnyAsync(c => c.TaxId == model.TaxId)) return Results.Conflict(new { field = "taxId", error = "Tax Id already exists." });
    if (await userMgr.FindByEmailAsync(model.Email) is not null) return Results.Conflict(new { field = "email", error = "Email already in use." });

    await using var tx = await db.Database.BeginTransactionAsync();

    try
    {
        var company = new Company
        {
            Name = model.CompanyName,
            TaxId = model.TaxId,
            Address = model.Address
        };
        db.Companies.Add(company);
        await db.SaveChangesAsync();

        var user = new ApplicationUser
        {
            UserName = model.Email,
            Email = model.Email,
            CompanyId = company.Id
        };

        var userResult = await userMgr.CreateAsync(user, model.Password);
        if (!userResult.Succeeded)
        {
            await tx.RollbackAsync();
            return Results.BadRequest(userResult.Errors);
        }

        if (!await roleMgr.RoleExistsAsync("Admin")) await roleMgr.CreateAsync(new IdentityRole("Admin"));

        await userMgr.AddToRoleAsync(user, "Admin");

        await tx.CommitAsync();
        return Results.Ok(new { companyId = company.Id, userId = user.Id, role = "Admin" });
    }
    catch (DbUpdateException ex)
    {
        await tx.RollbackAsync();
        return Results.Conflict(new { error = "Database constraint violation.", detail = ex.Message });
    }
    catch (Exception ex)
    {
        await tx.RollbackAsync();
        return Results.Problem(ex.Message, statusCode: 500);
    }
})
    .AddEndpointFilter<ValidationFilter<RegisterModel>>();

app.MapPost("/api/auth/login", async (EFactureDbContext db, UserManager<ApplicationUser> userManager, IConfiguration config, LoginModel model) =>
    {
        var user = await userManager.FindByEmailAsync(model.Email);
        if (user == null || !await userManager.CheckPasswordAsync(user, model.Password))
            return Results.Unauthorized();

        var company = await db.Companies
            .Where(c => c.Id == user.CompanyId)
            .Select(c => new
            {
                c.Id,
                c.Name,
                c.TaxId,
                c.Address,
                c.IsActive,
                c.IsVerified,
                c.CreatedAt,
                c.UpdatedAt
            })
            .FirstOrDefaultAsync();

        if (company is null) return Results.Problem("Company not found", statusCode: StatusCodes.Status500InternalServerError);

        var jwtKey = config["Jwt:Key"]!;
        var jwtIssuer = config["Jwt:Issuer"]!;
        var jwtAudience = config["Jwt:Audience"]!;
        var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
        var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);


        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id),
            new(ClaimTypes.Email, user.Email!),
            new("companyId", user.CompanyId.ToString())
        };
        var roles = await userManager.GetRolesAsync(user);
        claims.AddRange(roles.Select(role => new Claim(ClaimTypes.Role, role)));

        var token = new JwtSecurityToken(
            issuer: jwtIssuer,
            audience: jwtAudience,
            claims: claims,
            expires: DateTime.UtcNow.AddHours(2),
            signingCredentials: credentials
        );

        return Results.Ok(new
        {
            token = new JwtSecurityTokenHandler().WriteToken(token),
            company
        });
    })
    .Accepts<LoginModel>("application/json")
    .Produces(StatusCodes.Status200OK)
    .Produces(StatusCodes.Status401Unauthorized);

//--------

//--------Users CRUD

app.MapGet("/api/users", async (UserManager<ApplicationUser> userManager, ClaimsPrincipal user) =>
{
    var cid = GetCompanyId(user)!;
    var users = await userManager.Users.Where(u => u.CompanyId == cid)
        .Select(u => new { u.Id, u.Email })
        .ToListAsync();

    var result = new List<object>(users.Count);
    foreach (var u in users)
    {
        var usr = (await userManager.FindByIdAsync(u.Id))!;
        var roles = await userManager.GetRolesAsync(usr);
        result.Add(new
        {
            u.Id,
            u.Email,
            Roles = roles
        });
    }

    return Results.Ok(result);
})
    .RequireAuthorization("AdminOrManager");

app.MapGet("/api/users/{id}", async (string id, UserManager<ApplicationUser> userManager, ClaimsPrincipal principal) =>
    {
        var cid = GetCompanyId(principal);
        var user = await userManager.Users
            .Where(u => u.CompanyId == cid && u.Id == id)
            .SingleOrDefaultAsync();

        if (user is null) return Results.NotFound();

        var roles = await userManager.GetRolesAsync(user);
        return Results.Ok(new
        {
            user.Id,
            user.Email,
            Roles = roles
        });
    })
    .RequireAuthorization("AdminOrManager");

app.MapPost("/api/users", async (UserCreateModel model, ClaimsPrincipal principal, UserManager<ApplicationUser> userMgr, RoleManager<IdentityRole> roleMgr) =>
    {
        var callerIsManager = principal.IsInRole("Manager");

        var newRole = model.Role ?? "Clerk";
        if (newRole == "Admin") return Results.Forbid();
        if (callerIsManager && newRole == "Manager") return Results.Forbid();

        var companyId = GetCompanyId(principal);
        var user = new ApplicationUser
        {
            UserName = model.Email,
            Email = model.Email,
            CompanyId = companyId
        };

        var createRes = await userMgr.CreateAsync(user, model.Password);
        if (!createRes.Succeeded) return Results.BadRequest(createRes.Errors);

        if (!await roleMgr.RoleExistsAsync(newRole)) await roleMgr.CreateAsync(new IdentityRole(newRole));
        await userMgr.AddToRoleAsync(user, newRole);

        return Results.Created($"/api/users/{user.Id}", new { user.Id, user.Email, Role = newRole });
    })
    .AddEndpointFilter<ValidationFilter<UserCreateModel>>()
    .RequireAuthorization("AdminOrManager");

app.MapPut("/api/users/{id}", async (string id, UserUpdateModel model, ClaimsPrincipal caller, UserManager<ApplicationUser> userMgr, RoleManager<IdentityRole> roleMgr) =>
{
    var callerId = caller.FindFirstValue(ClaimTypes.NameIdentifier);
    var callerIsAdmin = caller.IsInRole("Admin");
    var callerIsManager = caller.IsInRole("Manager");
    if (!(callerIsAdmin || callerIsManager)) return Results.Forbid();

    var companyId = GetCompanyId(caller);
    var user = await userMgr.Users.SingleOrDefaultAsync(u => u.Id == id && u.CompanyId == companyId);
    if (user is null) return Results.NotFound();

    var targetRoles = await userMgr.GetRolesAsync(user);
    var isTargetAdmin = targetRoles.Contains("Admin");

    if (isTargetAdmin)
    {
        if (id != callerId || model.Password == null || model.Email != null || model.Role != null)
            return Results.Problem(detail: "Primary Admin may only reset their own password (no other fields).",
                statusCode: StatusCodes.Status403Forbidden);

        var resetToken = await userMgr.GeneratePasswordResetTokenAsync(user);
        var passRes = await userMgr.ResetPasswordAsync(user, resetToken, model.Password);
        return !passRes.Succeeded ? Results.BadRequest(passRes.Errors) : Results.NoContent();
    }

    var hasChanged = false;

    if (model.Email != null && !string.Equals(model.Email, user.Email, StringComparison.OrdinalIgnoreCase))
    {
        user.Email = model.Email;
        user.UserName = model.Email;
        hasChanged = true;
    }

    if (model.Password != null)
    {
        var token = await userMgr.GeneratePasswordResetTokenAsync(user);
        var result = await userMgr.ResetPasswordAsync(user, token, model.Password);
        if (!result.Succeeded) return Results.BadRequest(result.Errors);
    }

    if (model.Role != null)
    {
        if (!callerIsAdmin) return Results.Forbid();
        if (model.Role == "Admin")
            return Results.Problem(detail: "Cannot elevate any user to Admin.",
                statusCode: StatusCodes.Status403Forbidden);

        var current = (await userMgr.GetRolesAsync(user)).Single();
        if (current != model.Role)
        {
            await userMgr.RemoveFromRoleAsync(user, current);
            if (!await roleMgr.RoleExistsAsync(model.Role)) await roleMgr.CreateAsync(new IdentityRole(model.Role));
            await userMgr.AddToRoleAsync(user, model.Role);
        }
    }

    if (!hasChanged) return Results.NoContent();
    var upd = await userMgr.UpdateAsync(user);
    return !upd.Succeeded ? Results.BadRequest(upd.Errors) : Results.NoContent();
})
    .AddEndpointFilter<ValidationFilter<UserUpdateModel>>()
    .RequireAuthorization("AdminOrManager");

app.MapDelete("/api/users/{id}", async (string id, ClaimsPrincipal caller, UserManager<ApplicationUser> userMgr) =>
{
    if (!caller.IsInRole("Admin")) return Results.Forbid();
    var companyId = GetCompanyId(caller);
    var target = await userMgr.Users.SingleOrDefaultAsync(u => u.Id == id && u.CompanyId == companyId);

    if (target is null) return Results.NotFound();
    var targetRoles = await userMgr.GetRolesAsync(target);
    if (targetRoles.Contains("Admin")) return Results.Problem(detail: "Cannot delete the primary Admin account.", statusCode: StatusCodes.Status403Forbidden);
    if (target.Id == GetUid(caller)) return Results.BadRequest("Cannot delete your own account.");

    var res = await userMgr.DeleteAsync(target);
    return res.Succeeded ? Results.NoContent() : Results.BadRequest(res.Errors);
})
    .RequireAuthorization("Admin");

//--------



#endregion

app.MapControllers();


app.Run();
return;

static List<string> ValidateInvoice(Invoice inv, EFactureDbContext db)
{
    var errs = new List<string>();

    if (string.IsNullOrWhiteSpace(inv.InvoiceNumber))
        errs.Add("InvoiceNumber is required.");
    if (inv.Date.Date > DateTime.UtcNow.Date)
        errs.Add("Date cannot be in the future.");
    if (string.IsNullOrWhiteSpace(inv.CustomerName))
        errs.Add("CustomerName is required.");

    if (db.Invoices.Any(i =>
            i.Id != inv.Id &&
            i.CompanyId == inv.CompanyId &&
            i.InvoiceNumber == inv.InvoiceNumber))
    {
        errs.Add("InvoiceNumber must be unique.");
    }

    foreach (var line in inv.Lines)
    {
        if (string.IsNullOrWhiteSpace(line.Description))
            errs.Add("Each line needs a description.");
        if (line.Quantity <= 0)
            errs.Add("Line quantity must be > 0.");
        if (line.UnitPrice < 0)
            errs.Add("Line unit price cannot be negative.");
    }

    return errs;
}

static string? GetUid(ClaimsPrincipal user) => user.FindFirstValue(ClaimTypes.NameIdentifier);

static Guid GetCompanyId(ClaimsPrincipal user) => Guid.Parse(user.FindFirst("companyId")!.Value);

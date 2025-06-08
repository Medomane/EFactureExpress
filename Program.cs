using System.Globalization;
using System.IdentityModel.Tokens.Jwt;
using CsvHelper;
using CsvHelper.Configuration;
using EFacture.API.Data;
using EFacture.API.Models;
using EFacture.API.Services;
using Microsoft.EntityFrameworkCore;
using QuestPDF.Infrastructure;
using QuestPDF;
using Minio.DataModel.Args;
using Minio;

using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using EFacture.API.Validators;
using FluentValidation.AspNetCore;
using FluentValidation;
using Serilog;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;



static string? GetUid(ClaimsPrincipal user) => user.FindFirstValue(ClaimTypes.NameIdentifier);

var builder = WebApplication.CreateBuilder(args);

Settings.License = LicenseType.Community;

Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Debug()
    .WriteTo.Console()
    .WriteTo.File("Logs/log-.txt", rollingInterval: RollingInterval.Day)
    .CreateLogger();

builder.Host.UseSerilog();

// 1. Add CORS service
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

var jwtKey = builder.Configuration["Jwt:Key"];
var jwtIssuer = builder.Configuration["Jwt:Issuer"];
builder.Services.AddAuthentication(options =>
    {
        options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
        options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
    })
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtIssuer,
            ValidAudience = jwtIssuer,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey!))
        };
    });

builder.Services.AddAuthorization();

builder.Services.AddEndpointsApiExplorer();

builder.Services.AddScoped<InvoicePdfService>();




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

app.UseCors("AllowReactDev");

app.UseAuthentication();
app.UseAuthorization();


using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<EFactureDbContext>();
    db.Database.Migrate();
}


app.MapGet("/", () => "E-Facture API running ✅");

app.MapGet("/api/invoices", async (EFactureDbContext db, ClaimsPrincipal user) =>
{
    var uid = GetUid(user)!;
    return await db.Invoices
        .Include(i => i.Lines)
        .Where(i => i.ApplicationUserId == uid)
        .ToListAsync();
}).RequireAuthorization();

app.MapGet("/api/invoices/{id:int}", async (int id, EFactureDbContext db, ClaimsPrincipal user) =>
{
    var uid = GetUid(user)!;
    var invoice = await db.Invoices
        .Include(i => i.Lines)
        .FirstOrDefaultAsync(i => i.Id == id && i.ApplicationUserId == uid);
    return invoice is not null ? Results.Ok(invoice) : Results.NotFound();
}).RequireAuthorization();

app.MapPost("/api/invoices", async (Invoice newInvoice, EFactureDbContext db, InvoicePdfService pdfService, ClaimsPrincipal user) =>
{
    newInvoice.ApplicationUserId = GetUid(user)!;
    db.Invoices.Add(newInvoice);
    await db.SaveChangesAsync();
    var pdfBytes = await pdfService.GeneratePdfAsync(newInvoice.Id);
    if(pdfBytes != null) await pdfService.UploadPdfToMinioAsync(newInvoice.Id, pdfBytes);
    return Results.Created($"/api/invoices/{newInvoice.Id}", newInvoice);
}).AddEndpointFilter<ValidationFilter<Invoice>>().RequireAuthorization();

app.MapPut("/api/invoices/{id:int}", async (int id, Invoice updated, EFactureDbContext db, InvoicePdfService pdfService, ClaimsPrincipal user) =>
{
    var uid = GetUid(user)!;
    var existingInvoice = await db.Invoices
        .Include(i => i.Lines)
        .FirstOrDefaultAsync(i =>
            i.Id == id &&
            i.ApplicationUserId == uid
        );

    if (existingInvoice is null)
        return Results.NotFound();

    // Update fields
    existingInvoice.InvoiceNumber = updated.InvoiceNumber;
    existingInvoice.Date = updated.Date;
    existingInvoice.CustomerName = updated.CustomerName;
    existingInvoice.SubTotal = updated.SubTotal;
    existingInvoice.VAT = updated.VAT;
    existingInvoice.Total = updated.Total;

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

    /*invoice.SubTotal = invoice.Lines.Sum(l => l.Quantity * l.UnitPrice);
    invoice.VAT = Math.Round(invoice.SubTotal * 0.2m, 2);
    invoice.Total = invoice.SubTotal + invoice.VAT;*/

    await db.SaveChangesAsync();
    var pdfBytes = await pdfService.GeneratePdfAsync(existingInvoice.Id);
    if (pdfBytes != null) await pdfService.UploadPdfToMinioAsync(existingInvoice.Id, pdfBytes);
    return Results.NoContent();
}).AddEndpointFilter<ValidationFilter<Invoice>>().RequireAuthorization();

app.MapDelete("/api/invoices/{id:int}", async (int id, EFactureDbContext db, ClaimsPrincipal user) =>
{
    var uid = GetUid(user)!;
    var invoice = await db.Invoices.FirstOrDefaultAsync(i =>
        i.Id == id &&
        i.ApplicationUserId == uid
    );
    if (invoice is null) return Results.NotFound();

    db.Invoices.Remove(invoice);
    await db.SaveChangesAsync();
    return Results.NoContent();
}).RequireAuthorization();

/*app.MapPost("/api/invoices/{id:int}/generate-pdf", async (int id, InvoicePdfService pdfService) =>
{
    var pdfBytes = await pdfService.GeneratePdfAsync(id);
    if (pdfBytes is null) return Results.NotFound($"Invoice {id} not found.");

    await pdfService.UploadPdfToMinioAsync(id, pdfBytes);
    return Results.Ok(new { Message = "PDF generated and uploaded." });
}).RequireAuthorization();*/

app.MapPost("/api/invoices/import-csv", async (HttpRequest req, EFactureDbContext db, InvoicePdfService pdfService, ClaimsPrincipal user) =>
{
    if (!req.HasFormContentType)
        return Results.BadRequest("Content-type must be multipart/form-data");

    var form = await req.ReadFormAsync();
    var file = form.Files.GetFile("file");
    if (file is null || file.Length == 0)
        return Results.BadRequest("No file uploaded");

    // 1. Read CSV into records
    List<InvoiceCsvRecord> records;
    using (var reader = new StreamReader(file.OpenReadStream()))
    using (var csv = new CsvReader(reader, new CsvConfiguration(CultureInfo.InvariantCulture)
           {
               HasHeaderRecord = true,
           }))
    {
        records = csv.GetRecords<InvoiceCsvRecord>().ToList();
    }

    if (!records.Any())
        return Results.BadRequest("CSV is empty");

    var uid = GetUid(user)!;
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
            ApplicationUserId = uid
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
}).RequireAuthorization();

app.MapGet("/api/invoices/{id:int}/pdf-url", async (int id, EFactureDbContext db, IConfiguration config, ClaimsPrincipal user) =>
{
    var uid = GetUid(user)!;

    // ensure the invoice belongs to this user
    var exists = await db.Invoices
        .AnyAsync(i => i.Id == id && i.ApplicationUserId == uid);
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
}).RequireAuthorization();

app.MapPost("/api/invoices/{id:int}/submit", async (int id, EFactureDbContext db, ClaimsPrincipal user) =>
{
    var uid = GetUid(user)!;
    var invoice = await db.Invoices.FirstOrDefaultAsync(i =>
        i.Id == id &&
        i.ApplicationUserId == uid
    );
    if (invoice is null) return Results.NotFound();
    invoice.Status = InvoiceStatus.Submitted;
    await db.SaveChangesAsync();
    return Results.Ok(invoice);
}).RequireAuthorization();

app.MapPost("/api/auth/register", async (UserManager<ApplicationUser> userManager, RegisterModel model) =>
{
    var user = new ApplicationUser { UserName = model.Email, Email = model.Email };
    var result = await userManager.CreateAsync(user, model.Password);
    return result.Succeeded
        ? Results.Ok("User registered")
        : Results.BadRequest(result.Errors);
});

app.MapPost("/api/auth/login", async (UserManager<ApplicationUser> userManager, IConfiguration config, LoginModel model) =>
{
    var user = await userManager.FindByEmailAsync(model.Email);
    if (user == null || !await userManager.CheckPasswordAsync(user, model.Password))
        return Results.Unauthorized();

    var jwtKey = config["Jwt:Key"]!;
    var jwtIssuer = config["Jwt:Issuer"]!;
    var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
    var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);


    var claims = new[]
    {
        new Claim(ClaimTypes.NameIdentifier, user.Id),
        new Claim(ClaimTypes.Email, user.Email!)
    };


    var token = new JwtSecurityToken(
        issuer: jwtIssuer,
        audience: jwtIssuer,
        claims: claims,
        expires: DateTime.UtcNow.AddHours(2),
        signingCredentials: credentials
    );

    return Results.Ok(new { token = new JwtSecurityTokenHandler().WriteToken(token) });
})
.Accepts<LoginModel>("application/json")
.Produces(StatusCodes.Status200OK)
.Produces(StatusCodes.Status401Unauthorized);



app.MapControllers();

app.Run();

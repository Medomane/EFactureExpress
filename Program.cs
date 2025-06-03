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

var builder = WebApplication.CreateBuilder(args);



Settings.License = LicenseType.Community;



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



builder.Services.AddDbContext<EFactureDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddControllers().AddJsonOptions(opts =>
{
    opts.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
});





// 1. Add Identity
builder.Services.AddIdentity<ApplicationUser, IdentityRole>(options =>
    {
        options.Password.RequireDigit = false;
        options.Password.RequiredLength = 6;
        options.Password.RequireNonAlphanumeric = false;
        options.Password.RequireUppercase = false;
    })
    .AddEntityFrameworkStores<EFactureDbContext>()
    .AddDefaultTokenProviders();

// 2. Configure JWT authentication
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





app.UseCors("AllowReactDev");


using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<EFactureDbContext>();
    db.Database.Migrate();
}



app.MapGet("/", () => "E-Facture API running ✅");



// Get all invoices
app.MapGet("/api/invoices", async (EFactureDbContext db) =>
    await db.Invoices
        .Include(i => i.Lines)
        .ToListAsync()
).RequireAuthorization();

// Get invoice by ID
app.MapGet("/api/invoices/{id:int}", async (int id, EFactureDbContext db) =>
    await db.Invoices
        .Include(i => i.Lines)
        .FirstOrDefaultAsync(i => i.Id == id) is { } invoice
        ? Results.Ok(invoice)
        : Results.NotFound()
).RequireAuthorization();

app.MapPost("/api/invoices", async (Invoice newInvoice, EFactureDbContext db, InvoicePdfService pdfService) =>
{
    // EF will insert both Invoice and its Lines because of relationship
    db.Invoices.Add(newInvoice);
    await db.SaveChangesAsync();
    var pdfBytes = await pdfService.GeneratePdfAsync(newInvoice.Id);
    if(pdfBytes != null) await pdfService.UploadPdfToMinioAsync(newInvoice.Id, pdfBytes);
    return Results.Created($"/api/invoices/{newInvoice.Id}", newInvoice);
}).RequireAuthorization();

app.MapPut("/api/invoices/{id:int}", async (int id, Invoice updated, EFactureDbContext db, InvoicePdfService pdfService) =>
{
    var invoice = await db.Invoices.FindAsync(id);
    if (invoice is null) return Results.NotFound();

    // Update fields
    invoice.InvoiceNumber = updated.InvoiceNumber;
    invoice.Date = updated.Date;
    invoice.CustomerName = updated.CustomerName;
    invoice.SubTotal = updated.SubTotal;
    invoice.VAT = updated.VAT;
    invoice.Total = updated.Total;

    await db.SaveChangesAsync();
    var pdfBytes = await pdfService.GeneratePdfAsync(invoice.Id);
    if (pdfBytes != null) await pdfService.UploadPdfToMinioAsync(invoice.Id, pdfBytes);
    return Results.NoContent();
}).RequireAuthorization();

app.MapDelete("/api/invoices/{id:int}", async (int id, EFactureDbContext db) =>
{
    var invoice = await db.Invoices.FindAsync(id);
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

app.MapPost("/api/invoices/import-csv", async (HttpRequest req, EFactureDbContext db, InvoicePdfService pdfService) =>
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
            }).ToList()
        };
        // Compute totals
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

app.MapGet("/api/invoices/{id:int}/pdf-url", async (int id, IConfiguration config) =>
{
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



// Register endpoint
app.MapPost("/api/auth/register", async (UserManager<ApplicationUser> userManager, RegisterModel model) =>
{
    var user = new ApplicationUser { UserName = model.Email, Email = model.Email };
    var result = await userManager.CreateAsync(user, model.Password);
    return result.Succeeded
        ? Results.Ok("User registered")
        : Results.BadRequest(result.Errors);
});

// Login endpoint
app.MapPost("/api/auth/login", async (UserManager<ApplicationUser> userManager, IConfiguration config, LoginModel model) =>
{
    var user = await userManager.FindByEmailAsync(model.Email);
    if (user == null || !await userManager.CheckPasswordAsync(user, model.Password))
        return Results.Unauthorized();

    var jwtKey = config["Jwt:Key"]!;
    var jwtIssuer = config["Jwt:Issuer"]!;
    var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
    var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);

    var token = new JwtSecurityToken(
        issuer: jwtIssuer,
        audience: jwtIssuer,
        claims: null,
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

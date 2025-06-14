using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using EFacture.API.Data;
using Minio;
using Microsoft.EntityFrameworkCore;
using Minio.DataModel.Args;
using QRCoder;


namespace EFacture.API.Services
{
    public class InvoicePdfService
    {
        private readonly EFactureDbContext _db;
        private readonly IMinioClient _minio;
        private readonly string _bucket;

        public InvoicePdfService(EFactureDbContext db, IConfiguration config)
        {
            _db = db;
            // Configure MinIO client
            _minio = new MinioClient()
                .WithEndpoint(config["Minio:Endpoint"]!)
                .WithCredentials(
                    config["Minio:AccessKey"]!,
                    config["Minio:SecretKey"]!
                )
                .Build();
            _bucket = config["Minio:BucketName"]!;
        }

        public async Task<byte[]?> GeneratePdfAsync(int invoiceId)
        {
            var invoice = await _db.Invoices
                .Include(i => i.Lines)
                .FirstOrDefaultAsync(i => i.Id == invoiceId);

            if (invoice is null) return null;

            // 1. Generate QR-code PNG bytes
            using var qrGenerator = new QRCodeGenerator();
            using var qrCodeData = qrGenerator.CreateQrCode(
                $"INV:{invoice.InvoiceNumber};DATE:{invoice.Date:yyyy-MM-dd};TOTAL:{invoice.Total}",
                QRCodeGenerator.ECCLevel.M);
            var pngQr = new PngByteQRCode(qrCodeData);
            byte[] qrBytes = pngQr.GetGraphic(20);

            // Build PDF document in memory
            var document = Document.Create(container =>
            {
                container.Page(page =>
                {
                    page.Margin(30);
                    page.Header().Row(row =>
                    {
                        row.RelativeItem()
                            .Text($"Invoice #{invoice.InvoiceNumber}")
                            .FontSize(20).Bold();

                        row.ConstantItem(100).Height(100)
                            .Image(qrBytes);  // PNG bytes of QR
                    });

                    page.Content().Column(col =>
                    {
                        col.Item().Text($"Customer: {invoice.CustomerName}").FontSize(12);
                        col.Item().PaddingVertical(10).LineHorizontal(1);

                        // Table of lines
                        col.Item().Table(table =>
                        {
                            // Columns: Description, Qty, Unit, Total
                            table.ColumnsDefinition(columns =>
                            {
                                columns.ConstantColumn(250);
                                columns.ConstantColumn(50);
                                columns.ConstantColumn(80);
                                columns.ConstantColumn(80);
                            });

                            // Header row
                            table.Header(header =>
                            {
                                header.Cell().Element(CellStyle).Text("Description").Bold();
                                header.Cell().Element(CellStyle).AlignCenter().Text("Qty").Bold();
                                header.Cell().Element(CellStyle).AlignRight().Text("Unit Price").Bold();
                                header.Cell().Element(CellStyle).AlignRight().Text("Line Total").Bold();
                            });

                            // Data rows
                            foreach (var line in invoice.Lines)
                            {
                                table.Cell().Element(CellStyle).Text(line.Description);
                                table.Cell().Element(CellStyle).AlignCenter().Text(line.Quantity.ToString());
                                table.Cell().Element(CellStyle).AlignRight().Text($"{line.UnitPrice:C}");
                                table.Cell().Element(CellStyle).AlignRight().Text($"{line.Total:C}");
                            }

                            static IContainer CellStyle(IContainer container)
                            {
                                return container.PaddingVertical(5).BorderBottom(1).BorderColor(Colors.Grey.Lighten2);
                            }
                        });

                        col.Item().PaddingVertical(10).LineHorizontal(1);

                        // Totals
                        col.Item().AlignRight().Text($"Subtotal: {invoice.SubTotal:C}");
                        col.Item().AlignRight().Text($"VAT: {invoice.VAT:C}");
                        col.Item().AlignRight().Text($"Total: {invoice.Total:C}").FontSize(14).Bold();
                    });

                    page.Footer().AlignCenter()
                        .Text($"Generated on {DateTime.Now:yyyy-MM-dd HH:mm}");

                });
            });

            using var ms = new MemoryStream();
            document.GeneratePdf(ms);
            return ms.ToArray();
        }

        public async Task<bool> UploadPdfToMinioAsync(int invoiceId, byte[] pdfBytes)
        {
            try
            {
                var objectName = $"invoices/{invoiceId}.pdf";

                // Ensure bucket exists
                bool found = await _minio.BucketExistsAsync(new BucketExistsArgs().WithBucket(_bucket));
                if (!found)
                {
                    await _minio.MakeBucketAsync(new MakeBucketArgs().WithBucket(_bucket));
                }

                using var stream = new MemoryStream(pdfBytes);
                await _minio.PutObjectAsync(
                    new PutObjectArgs()
                        .WithBucket(_bucket)
                        .WithObject(objectName)
                        .WithStreamData(stream)
                        .WithObjectSize(pdfBytes.Length)
                        .WithContentType("application/pdf")
                );
                return true;
            }
            catch (Exception)
            {
                return false;
            }
        }

    }
}

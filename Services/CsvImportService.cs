using EFacture.API.Models;

namespace EFacture.API.Services
{
    public class CsvImportService
    {
        /// <summary>
        /// Validates that the uploaded file is a non-empty CSV with all required headers.
        /// </summary>
        public CsvRowValidationResult ValidateFile(IFormFile file)
        {
            var result = new CsvRowValidationResult();

            // 1. Extension check
            if (Path.GetExtension(file.FileName).ToLower() != ".csv")
                result.Errors.Add("Only .csv files are allowed.");

            // 2. Empty or missing header
            using var stream = file.OpenReadStream();
            using var reader = new StreamReader(stream);
            var headerLine = reader.ReadLine();
            if (string.IsNullOrWhiteSpace(headerLine))
                result.Errors.Add("File is empty or missing header.");

            // 3. Required columns
            var delimiter = headerLine!.Contains(';') ? ';' : ',';
            var headers = headerLine.Split(delimiter);
            var required = new[] { "InvoiceNumber", "Date", "CustomerName", "Description", "Quantity", "UnitPrice" };
            foreach (var h in required)
            {
                if (headers == null || !headers.Contains(h, StringComparer.OrdinalIgnoreCase))
                    result.Errors.Add($"Missing required column: {h}");
            }

            //result.IsValid = !result.Errors.Any();
            return result;
        }

        public List<CsvRowValidationResult> ValidateRows(IEnumerable<InvoiceCsvRecord> records)
        {
            var results = new List<CsvRowValidationResult>();
            // Start at 2 to account for header row
            var rowNumber = 2;

            foreach (var rec in records)
            {
                var result = new CsvRowValidationResult
                {
                    RowNumber = rowNumber,
                    Record = rec
                };

                if (string.IsNullOrWhiteSpace(rec.InvoiceNumber))
                    result.Errors.Add("InvoiceNumber is required.");
                if (rec.Date == default)
                    result.Errors.Add("Date is invalid or missing.");
                if (string.IsNullOrWhiteSpace(rec.CustomerName))
                    result.Errors.Add("CustomerName is required.");
                if (string.IsNullOrWhiteSpace(rec.Description))
                    result.Errors.Add("Description is required.");
                if (rec.Quantity <= 0)
                    result.Errors.Add("Quantity must be greater than zero.");
                if (rec.UnitPrice < 0)
                    result.Errors.Add("UnitPrice cannot be negative.");

                results.Add(result);
                rowNumber++;
            }

            return results;
        }
    }
}
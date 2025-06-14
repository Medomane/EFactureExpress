namespace EFacture.API.Models
{
    public class CsvRowValidationResult
    {
        /// <summary>
        /// The Excel/CSV row number (assuming header is row 1).
        /// </summary>
        public int RowNumber { get; set; }

        /// <summary>
        /// The parsed record for reference.
        /// </summary>
        public InvoiceCsvRecord Record { get; set; } = null!;

        /// <summary>
        /// One or more error messages describing why this row is invalid.
        /// </summary>
        public List<string> Errors { get; } = new();

        /// <summary>
        /// True if no errors were recorded.
        /// </summary>
        public bool IsValid => !Errors.Any();
    }
}
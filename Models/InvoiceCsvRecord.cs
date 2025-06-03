namespace EFacture.API.Models
{
    public class InvoiceCsvRecord
    {
        public string InvoiceNumber { get; set; } = null!;
        public DateTime Date { get; set; }
        public string CustomerName { get; set; } = null!;
        public string Description { get; set; } = null!;
        public decimal Quantity { get; set; }
        public decimal UnitPrice { get; set; }
    }
}

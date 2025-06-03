namespace EFacture.API.Models
{
    public class Invoice
    {
        public int Id { get; set; }
        public string InvoiceNumber { get; set; } = null!;
        public DateTime Date { get; set; }
        public string CustomerName { get; set; } = null!;
        public decimal SubTotal { get; set; }
        public decimal VAT { get; set; }
        public decimal Total { get; set; }

        public List<InvoiceLine> Lines { get; set; } = new();
    }
}

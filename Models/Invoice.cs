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

        public InvoiceStatus Status { get; set; } = InvoiceStatus.Draft;

        public List<InvoiceLine> Lines { get; set; } = new();

        public Guid CompanyId { get; set; }
        public Company? Company { get; set; }

        public string? CreatedById { get; set; }
        public ApplicationUser? CreatedBy { get; set; }

        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
    }

    public enum InvoiceStatus
    {
        Draft,
        Ready,
        Submitted
    }
}

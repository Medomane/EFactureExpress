namespace EFacture.API.Models
{
    public class InvoiceStatusHistory
    {
        public int Id { get; set; }
        public int InvoiceId { get; set; }
        public Invoice Invoice { get; set; } = null!;

        // What the status was before the change
        public InvoiceStatus OldStatus { get; set; }

        // What it changed to
        public InvoiceStatus NewStatus { get; set; }

        // Who made the change
        public string ChangedBy { get; set; } = null!;

        // When it happened
        public DateTime ChangedAt { get; set; }
    }
}

using System.Text.Json.Serialization;

namespace EFacture.API.Models
{
    public class InvoiceLine
    {
        public int Id { get; set; }
        public string Description { get; set; } = null!;
        public decimal Quantity { get; set; }
        public decimal UnitPrice { get; set; }
        public decimal Total => Quantity * UnitPrice;

        // Foreign key
        public int InvoiceId { get; set; }
        [JsonIgnore]
        public Invoice Invoice { get; set; } = null!;
    }
}

using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace EFacture.API.Models
{
    public class InvoiceLine
    {
        public int Id { get; set; }
        public string Description { get; set; } = null!;
        public decimal Quantity { get; set; }
        public decimal UnitPrice { get; set; }
        [NotMapped] public decimal Total => Quantity * UnitPrice;

        public int InvoiceId { get; set; }
        [JsonIgnore]
        public Invoice Invoice { get; set; } = null!;
    }
}

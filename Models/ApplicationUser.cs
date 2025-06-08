using Microsoft.AspNetCore.Identity;

namespace EFacture.API.Models
{
    public class ApplicationUser : IdentityUser
    {
        public ICollection<Invoice> Invoices { get; set; } = new List<Invoice>();
    }
}

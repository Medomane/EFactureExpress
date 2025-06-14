using Microsoft.AspNetCore.Identity;

namespace EFacture.API.Models
{
    public class ApplicationUser : IdentityUser
    {
        public Guid CompanyId { get; set; }
        public Company? Company { get; set; }
    }
}

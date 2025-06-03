using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using EFacture.API.Models;

namespace EFacture.API.Data
{
    public class EFactureDbContext : IdentityDbContext<ApplicationUser>
    {
        public EFactureDbContext(DbContextOptions<EFactureDbContext> options)
            : base(options) { }
        public DbSet<Invoice> Invoices { get; set; } = null!;
        public DbSet<InvoiceLine> InvoiceLines { get; set; } = null!;
    }
}

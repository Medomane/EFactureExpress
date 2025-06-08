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


        protected override void OnModelCreating(ModelBuilder mb)
        {
            base.OnModelCreating(mb);
            mb.Entity<Invoice>()
                .HasOne(i => i.ApplicationUser)
                .WithMany(u => u.Invoices)
                .HasForeignKey(i => i.ApplicationUserId)
                .OnDelete(DeleteBehavior.Restrict);

            mb.Entity<Invoice>()
                .HasIndex(i => new { i.ApplicationUserId, i.Date }); // speeds monthly count
        }
    }
}

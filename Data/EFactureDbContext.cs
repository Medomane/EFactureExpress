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
        public DbSet<InvoiceStatusHistory> InvoiceStatusHistories { get; set; } = null!;
        public DbSet<Company> Companies => Set<Company>();


        protected override void OnModelCreating(ModelBuilder mb)
        {
            base.OnModelCreating(mb);


            mb.Entity<Invoice>()
                .Property(i => i.CreatedAt)
                .HasColumnType("datetime");

            mb.Entity<Invoice>()
                .Property(i => i.UpdatedAt)
                .HasColumnType("datetime");

            mb.Entity<Invoice>()
                .HasOne(i => i.Company)
                .WithMany(c => c.Invoices)
                .HasForeignKey(i => i.CompanyId)
                .OnDelete(DeleteBehavior.Restrict);

            mb.Entity<Company>().HasIndex(c => c.TaxId).IsUnique();
            mb.Entity<Invoice>()
                .HasIndex(i => new { i.CompanyId, i.InvoiceNumber })
                .IsUnique();

            mb.Entity<ApplicationUser>()
                .HasOne(u => u.Company)
                .WithMany(c => c.Users)
                .HasForeignKey(u => u.CompanyId)
                .OnDelete(DeleteBehavior.Restrict);


            mb.Entity<Invoice>().Property(p => p.SubTotal).HasColumnType("decimal(18,4)");
            mb.Entity<Invoice>().Property(p => p.Total).HasColumnType("decimal(18,4)");
            mb.Entity<Invoice>().Property(p => p.VAT).HasColumnType("decimal(18,4)");
            mb.Entity<InvoiceLine>().Property(p => p.UnitPrice).HasColumnType("decimal(18,4)");
        }
    }
}

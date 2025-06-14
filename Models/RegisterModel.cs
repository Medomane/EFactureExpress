namespace EFacture.API.Models
{
    public class RegisterModel
    {
        public string CompanyName { get; set; } = null!;
        public string TaxId { get; set; } = null!;
        public string? Address { get; set; }
        public string Email { get; set; } = null!;
        public string Password { get; set; } = null!;
        public string? Role { get; set; }
    }

    // Models/LoginModel.cs
    public class LoginModel
    {
        public string Email { get; set; } = null!;
        public string Password { get; set; } = null!;
    }
}

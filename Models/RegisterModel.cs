namespace EFacture.API.Models
{
    public class RegisterModel
    {
        public string Email { get; set; } = null!;
        public string Password { get; set; } = null!;
    }

    // Models/LoginModel.cs
    public class LoginModel
    {
        public string Email { get; set; } = null!;
        public string Password { get; set; } = null!;
    }
}

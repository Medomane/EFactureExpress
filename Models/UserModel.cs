namespace EFacture.API.Models
{
    public record UserCreateModel
    {
        public string Email { get; init; } = null!;
        public string Password { get; init; } = null!;
        public string? Role { get; init; }
    }

    public record UserUpdateModel
    {
        public string? Email { get; init; }
        public string? Password { get; init; }
        public string? Role { get; init; }
    }
}

using EFacture.API.Models;
using FluentValidation;

namespace EFacture.API.Validators
{
    public class RegisterModelValidator : AbstractValidator<RegisterModel>
    {
        public RegisterModelValidator()
        {
            RuleFor(x => x.CompanyName)
                .NotEmpty().WithMessage("Company name is required")
                .MaximumLength(120);

            // Moroccan ICE is 15 digits; loosen if needed
            RuleFor(x => x.TaxId)
                .NotEmpty().WithMessage("Tax Id (ICE) is required")
                .Matches(@"^\d{15}$")
                .WithMessage("Tax Id must be 15 digits");

            RuleFor(x => x.Address)
                .MaximumLength(255);

            RuleFor(x => x.Email)
                .NotEmpty().WithMessage("E-mail is required")
                .EmailAddress().WithMessage("Invalid e-mail format");

            RuleFor(x => x.Password)
                .NotEmpty().WithMessage("Password is required")
                .MinimumLength(8).WithMessage("Password must be at least 8 characters")
                .Matches("[A-Z]").WithMessage("Password needs an uppercase letter")
                .Matches("[a-z]").WithMessage("Password needs a lowercase letter")
                .Matches(@"\d").WithMessage("Password needs a digit");

            // Role must be empty on public sign-up
            RuleFor(x => x.Role)
                .Must(r => r == null)
                .WithMessage("Role cannot be set during self-registration");
        }
    }
}
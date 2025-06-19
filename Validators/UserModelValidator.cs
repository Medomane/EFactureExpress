using EFacture.API.Models;
using FluentValidation;

namespace EFacture.API.Validators
{
    public class UserCreateModelValidator : AbstractValidator<UserCreateModel>
    {
        public UserCreateModelValidator()
        {
            RuleFor(x => x.Email)
                .NotEmpty().EmailAddress();
            RuleFor(x => x.Password)
                .NotEmpty().MinimumLength(8)
                .Matches("[A-Z]").WithMessage("Need uppercase")
                .Matches("[a-z]").WithMessage("Need lowercase")
                .Matches(@"\d").WithMessage("Need digit");
            RuleFor(x => x.Role)
                .Must(r => r is null or "Clerk" or "Manager")
                .WithMessage("Role must be Clerk or Manager");
        }
    }

    public class UserUpdateModelValidator : AbstractValidator<UserUpdateModel>
    {
        public UserUpdateModelValidator()
        {
            RuleFor(x => x).Must(x => x.Email != null || x.Password != null || x.Role != null)
                .WithMessage("At least one field (Email, Password or Role) is required.");

            When(x => x.Email != null, () =>
            {
                RuleFor(x => x.Email!).EmailAddress();
            });

            When(x => x.Password != null, () =>
            {
                RuleFor(x => x.Password!)
                    .MinimumLength(8)
                    .Matches("[A-Z]").WithMessage("Need uppercase")
                    .Matches("[a-z]").WithMessage("Need lowercase")
                    .Matches(@"\d").WithMessage("Need digit");
            });

            When(x => x.Role != null, () =>
            {
                RuleFor(x => x.Role!)
                    .Must(r => r is "Clerk" or "Manager")
                    .WithMessage("Role must be Clerk or Manager");
            });
        }
    }

}

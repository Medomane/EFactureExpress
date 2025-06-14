using EFacture.API.Models;
using FluentValidation;
using Microsoft.AspNetCore.Mvc;

namespace EFacture.API.Validators
{
    public class InvoiceLineValidator : AbstractValidator<InvoiceLine>
    {
        public InvoiceLineValidator()
        {
            RuleFor(x => x.Description)
                .NotEmpty().WithMessage("Description is required")
                .MaximumLength(200);

            RuleFor(x => x.Quantity)
                .GreaterThan(0).WithMessage("Quantity must be greater than zero");

            RuleFor(x => x.UnitPrice)
                .GreaterThan(0).WithMessage("UnitPrice must be greater than zero");
        }
    }

    public class InvoiceValidator : AbstractValidator<Invoice>
    {
        public InvoiceValidator()
        {
            RuleFor(x => x.InvoiceNumber)
                .NotEmpty().WithMessage("InvoiceNumber is required")
                .Matches(@"^[A-Z0-9\-]+$").WithMessage("Invalid InvoiceNumber format");

            RuleFor(x => x.Date)
                .NotEmpty().WithMessage("Date is required")
                .LessThanOrEqualTo(DateTime.Today).WithMessage("Date cannot be in the future");

            RuleFor(x => x.CustomerName)
                .NotEmpty().WithMessage("CustomerName is required")
                .MaximumLength(100);

            RuleFor(x => x.Lines)
                .NotEmpty().WithMessage("At least one line item is required");

            RuleForEach(x => x.Lines).SetValidator(new InvoiceLineValidator());

            RuleFor(x => x.SubTotal)
                .GreaterThanOrEqualTo(0).WithMessage("SubTotal cannot be negative");

            RuleFor(x => x.VAT)
                .GreaterThanOrEqualTo(0).WithMessage("VAT cannot be negative");

            RuleFor(x => x.Total)
                .GreaterThan(0).WithMessage("Total must be greater than zero")
                .Equal(x => Math.Round(x.SubTotal + x.VAT, 2))
                .WithMessage("Total must equal SubTotal + VAT");
        }
    }

    public class ValidationFilter<T> : IEndpointFilter where T : class
    {
        public async ValueTask<object?> InvokeAsync(
            EndpointFilterInvocationContext context,
            EndpointFilterDelegate next)
        {
            if (context.Arguments.FirstOrDefault(arg => arg is T) is not T model) return Results.BadRequest();

            var validator = context.HttpContext.RequestServices.GetRequiredService<IValidator<T>>();
            var result = await validator.ValidateAsync(model);
            if (result.IsValid) return await next(context);
            var errors = result.Errors
                .GroupBy(e => e.PropertyName)
                .ToDictionary(
                    g => g.Key,
                    g => g.Select(e => e.ErrorMessage).ToArray()
                );
            return Results.BadRequest(new ValidationProblemDetails(errors));
        }
    }
}

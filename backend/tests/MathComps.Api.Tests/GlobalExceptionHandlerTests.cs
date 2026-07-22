using MathComps.Api.Extensions;
using MathComps.Infrastructure.Persistence;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;

namespace MathComps.Api.Tests;

/// <summary>
/// Guards that <see cref="GlobalExceptionHandler"/> recognizes every business exception the services can
/// throw. A new exception without a classification arm would silently fall through to a 500, and this
/// test catches that the moment the exception type is added.
/// </summary>
public class GlobalExceptionHandlerTests
{
    /// <summary>
    /// Every business exception maps to a client status (not a 500) and stamps its wire code.
    /// </summary>
    [Fact]
    public async Task Every_business_exception_maps_to_a_client_status_and_code()
    {
        // Most business exceptions live next to their service interfaces in the Infrastructure assembly
        var infrastructureExceptions = typeof(MathCompsDbContext).Assembly.GetTypes()
            .Where(type => typeof(Exception).IsAssignableFrom(type)
                && type.Namespace?.StartsWith("MathComps.Infrastructure.Services", StringComparison.Ordinal) == true);

        // A few (like UserNotResolvedException) are thrown by the endpoint layer and live in the Api assembly
        var apiExceptions = typeof(GlobalExceptionHandler).Assembly.GetTypes()
            .Where(type => typeof(Exception).IsAssignableFrom(type)
                && type.Namespace?.StartsWith("MathComps.Api", StringComparison.Ordinal) == true);

        // Both assemblies' business exceptions must classify
        var exceptionTypes = infrastructureExceptions.Concat(apiExceptions);

        // Drive each one through the real handler
        foreach (var exceptionType in exceptionTypes)
        {
            // Capture what the handler asks to write for this exception
            var problemDetails = new CapturingProblemDetailsService();
            var handler = new GlobalExceptionHandler(NullLogger<GlobalExceptionHandler>.Instance, problemDetails);
            var httpContext = new DefaultHttpContext();

            // Handle the exception as the pipeline would when it escapes an endpoint
            await handler.TryHandleAsync(httpContext, CreateException(exceptionType), CancellationToken.None);

            // A recognized failure maps to a client status, never the unexpected-fault 500
            Assert.NotEqual(StatusCodes.Status500InternalServerError, httpContext.Response.StatusCode);

            // ...and carries the wire code named after the exception (minus the "Exception" suffix)
            var expectedCode = exceptionType.Name[..^nameof(Exception).Length];
            Assert.Equal(expectedCode, problemDetails.Written?.Extensions["errorCode"]);
        }
    }

    /// <summary>
    /// Instantiates an exception via its fewest-argument constructor, filling parameters with placeholders.
    /// </summary>
    /// <param name="exceptionType">The exception type to construct.</param>
    /// <returns>A constructed instance of the exception.</returns>
    private static Exception CreateException(Type exceptionType)
    {
        // Pick the smallest constructor the compiler generated for the primary declaration
        var constructor = exceptionType.GetConstructors().MinBy(candidate => candidate.GetParameters().Length)!;

        // Fill string parameters with a placeholder and value types with their default
        var arguments = constructor.GetParameters()
            .Select(parameter => parameter.ParameterType == typeof(string)
                ? "x"
                : Activator.CreateInstance(parameter.ParameterType)!)
            .ToArray();

        // Build the instance
        return (Exception)constructor.Invoke(arguments);
    }

    /// <summary>
    /// An <see cref="IProblemDetailsService"/> that records the problem details it is asked to write
    /// instead of serializing them to a response.
    /// </summary>
    private sealed class CapturingProblemDetailsService : IProblemDetailsService
    {
        /// <summary>The problem details the handler last asked to write.</summary>
        public ProblemDetails? Written { get; private set; }

        /// <inheritdoc />
        public ValueTask<bool> TryWriteAsync(ProblemDetailsContext context)
        {
            // Record the payload
            Written = context.ProblemDetails;

            // Report a successful write
            return ValueTask.FromResult(true);
        }

        /// <inheritdoc />
        public ValueTask WriteAsync(ProblemDetailsContext context)
        {
            // Record the payload
            Written = context.ProblemDetails;

            // Nothing to report back
            return ValueTask.CompletedTask;
        }
    }
}

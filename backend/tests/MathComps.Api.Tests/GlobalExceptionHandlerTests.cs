using MathComps.Api.Errors;
using MathComps.Api.Extensions;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Competitions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;

namespace MathComps.Api.Tests;

/// <summary>
/// Guards that <see cref="GlobalExceptionHandler"/> recognizes every business exception the services can
/// throw. A new exception without a classification arm would silently fall through to a 500, and this
/// test catches that the moment the exception type is added. Also guards the one failure that never
/// reaches a service: a request body the framework itself refused.
/// </summary>
public class GlobalExceptionHandlerTests
{
    /// <summary>
    /// The refusals raised by services no endpoint calls, which have no HTTP meaning to classify. Naming them
    /// one by one rather than skipping their namespace keeps the guard on the exceptions that sit beside them:
    /// the competition endpoints throw several of their own out of the same folder.
    /// </summary>
    private static readonly HashSet<string> _cliOnly =
    [
        // Raised while a group manifest is declared, which only the Competitions CLI ever does
        nameof(HostedGroupManifestException),
    ];

    /// <summary>
    /// Every business exception a request can reach maps to a client status (not a 500) and stamps its wire code.
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

        // Both assemblies' business exceptions must classify, bar the ones no request can reach
        var exceptionTypes = infrastructureExceptions.Concat(apiExceptions)
            .Where(type => !_cliOnly.Contains(type.Name));

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
            Assert.True(
                httpContext.Response.StatusCode != StatusCodes.Status500InternalServerError,
                $"{exceptionType.Name} has no classification arm, so it reaches the client as a 500.");

            // ...and carries the wire code named after the exception (minus the "Exception" suffix)
            var expectedCode = exceptionType.Name[..^nameof(Exception).Length];
            Assert.Equal(expectedCode, problemDetails.Written?.Extensions["errorCode"]);
        }
    }

    /// <summary>
    /// A body the framework couldn't build the route's parameter from is the caller's fault, so it keeps the
    /// status the framework already judged rather than being reported as a fault of ours.
    /// </summary>
    [Fact]
    public async Task A_body_the_framework_refused_stays_the_callers_fault()
    {
        // Capture what the handler asks to write
        var problemDetails = new CapturingProblemDetailsService();
        var handler = new GlobalExceptionHandler(NullLogger<GlobalExceptionHandler>.Instance, problemDetails);
        var httpContext = new DefaultHttpContext();

        // This is what reading a malformed JSON body throws before any endpoint runs
        var refusal = new BadHttpRequestException("Failed to read parameter from the request body as JSON.",
            StatusCodes.Status400BadRequest);

        // Handle it as the pipeline would
        await handler.TryHandleAsync(httpContext, refusal, CancellationToken.None);

        // The framework's own status carries through instead of being downgraded to an unexpected fault
        Assert.Equal(StatusCodes.Status400BadRequest, httpContext.Response.StatusCode);

        // ...under the code that says the body was the problem
        Assert.Equal(nameof(ApiErrorCode.MalformedRequest), problemDetails.Written?.Extensions["errorCode"]);
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

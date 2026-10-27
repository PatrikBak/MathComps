using MathComps.Api.Errors;
using MathComps.Infrastructure.Services;
using Microsoft.AspNetCore.Diagnostics;

namespace MathComps.Api.Extensions;

/// <summary>
/// An <see cref="IExceptionHandler"/> that translates exceptions escaping the endpoints into RFC 9457
/// problem responses. A known business exception is mapped to its HTTP status plus the machine-readable
/// <c>errorCode</c> and logged at the level it states; anything else is an unexpected fault, logged as an error and
/// returned as a bare <c>500</c>, never leaking a stack trace or an HTML error page.
/// </summary>
/// <param name="logger">The logger.</param>
/// <param name="problemDetailsService">Writes the RFC 9457 problem body.</param>
public sealed class GlobalExceptionHandler(
    ILogger<GlobalExceptionHandler> logger,
    IProblemDetailsService problemDetailsService) : IExceptionHandler
{
    /// <inheritdoc />
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        // A recognized business failure maps to a client-facing status and code
        if (Classify(exception) is { } mapping)
        {
            // Record the refusal at the level its exception states. The framework's BadHttpRequestException states
            // none, so it logs at Error like every exception that isn't a MathCompsException
            logger.Log(
                exception is MathCompsException { LogLevel: var level } ? level : LogLevel.Error,
                exception,
                "{ErrorCode} ({StatusCode}) for {Method} {Path}",
                mapping.Code,
                mapping.Status,
                httpContext.Request.Method,
                httpContext.Request.Path);

            // Write the problem body carrying that status, the exception's detail, and the code
            await ProblemResponseWriter.WriteAsync(
                problemDetailsService, httpContext, mapping.Status, mapping.Code, exception.Message, exception);

            // The fault is handled — the mapped status stands even if the writer declined the body
            return true;
        }

        // Everything else is an unexpected fault worth recording
        logger.LogError(
            exception,
            "Unhandled exception for {Method} {Path}",
            httpContext.Request.Method,
            httpContext.Request.Path);

        // An unexpected fault is a server error
        httpContext.Response.StatusCode = StatusCodes.Status500InternalServerError;

        // Write a bare problem body — no detail, so nothing internal leaks
        await problemDetailsService.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            Exception = exception,
            ProblemDetails =
            {
                Status = StatusCodes.Status500InternalServerError,
                Title = "An unexpected error occurred."
            }
        });

        // The fault is handled — a declined body still leaves the 500 status in place
        return true;
    }

    /// <summary>
    /// Maps a recognized business exception to its HTTP status and wire code, or null when the exception
    /// is not a known business failure (and so is an unexpected fault).
    /// </summary>
    /// <param name="exception">The exception to classify.</param>
    /// <returns>The HTTP status and machine-readable code, or null if unrecognized.</returns>
    private static (int Status, string Code)? Classify(Exception exception) => exception switch
    {
        // A business failure answers with its kind's status, under its type's name less the "Exception" suffix
        MathCompsException refusal => (StatusOf(refusal.Kind), refusal.GetType().Name[..^nameof(Exception).Length]),

        // A request the route can't use, refused by the framework or by the endpoint itself; carrying its own
        // status through is what stops a caller's bad request reading as our fault
        BadHttpRequestException badRequest => (badRequest.StatusCode, nameof(ApiErrorCode.MalformedRequest)),

        // Not a known business failure — treat as an unexpected fault
        _ => null
    };

    /// <summary>
    /// The HTTP status a kind of refusal answers with.
    /// </summary>
    /// <param name="kind">The kind of refusal.</param>
    /// <returns>The status code.</returns>
    private static int StatusOf(RefusalKind kind) => kind switch
    {
        RefusalKind.Invalid => StatusCodes.Status400BadRequest,
        RefusalKind.Unauthenticated => StatusCodes.Status401Unauthorized,
        RefusalKind.Forbidden => StatusCodes.Status403Forbidden,
        RefusalKind.NotFound => StatusCodes.Status404NotFound,
        RefusalKind.Conflict => StatusCodes.Status409Conflict,
        RefusalKind.PreconditionUnmet => StatusCodes.Status422UnprocessableEntity,
        RefusalKind.Throttled => StatusCodes.Status429TooManyRequests,
        _ => throw new ArgumentOutOfRangeException(nameof(kind), kind, "Unknown refusal kind"),
    };
}

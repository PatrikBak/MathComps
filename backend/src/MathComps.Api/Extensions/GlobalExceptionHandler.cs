using MathComps.Api.Endpoints;
using MathComps.Api.Errors;
using MathComps.Infrastructure.Services.Comments;
using MathComps.Infrastructure.Services.Defense;
using MathComps.Infrastructure.Services.Problems;
using MathComps.Infrastructure.Services.Users;
using Microsoft.AspNetCore.Diagnostics;

namespace MathComps.Api.Extensions;

/// <summary>
/// An <see cref="IExceptionHandler"/> that translates exceptions escaping the endpoints into RFC 9457
/// problem responses. A known business exception is mapped to its HTTP status plus the machine-readable
/// <c>errorCode</c>; anything else is an unexpected fault, logged and returned as a bare <c>500</c>,
/// never leaking a stack trace or an HTML error page.
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
    /// is not a known business failure (and so is an unexpected fault). A new business exception must be
    /// added here.
    /// </summary>
    /// <param name="exception">The exception to classify.</param>
    /// <returns>The HTTP status and machine-readable code, or null if unrecognized.</returns>
    private static (int Status, ApiErrorCode Code)? Classify(Exception exception) => exception switch
    {
        // Missing resources
        CommentNotFoundException => (StatusCodes.Status404NotFound, ApiErrorCode.CommentNotFound),
        CommentTargetNotFoundException => (StatusCodes.Status404NotFound, ApiErrorCode.CommentTargetNotFound),
        ProblemNotFoundException => (StatusCodes.Status404NotFound, ApiErrorCode.ProblemNotFound),
        ListNotFoundException => (StatusCodes.Status404NotFound, ApiErrorCode.ListNotFound),
        DefenseSessionNotFoundException => (StatusCodes.Status404NotFound, ApiErrorCode.DefenseSessionNotFound),

        // Defense guardrails — the request or the user's usage is over a cap
        DefenseMessageTooLongException => (StatusCodes.Status400BadRequest, ApiErrorCode.DefenseMessageTooLong),
        DefenseMessageEmptyException => (StatusCodes.Status400BadRequest, ApiErrorCode.DefenseMessageEmpty),
        DefenseRewindTargetException => (StatusCodes.Status400BadRequest, ApiErrorCode.DefenseRewindTarget),
        DefenseReportTargetException => (StatusCodes.Status400BadRequest, ApiErrorCode.DefenseReportTarget),
        DefenseFeedbackValueException => (StatusCodes.Status400BadRequest, ApiErrorCode.DefenseFeedbackValue),
        DefenseFeedbackCommentTooLongException
            => (StatusCodes.Status400BadRequest, ApiErrorCode.DefenseFeedbackCommentTooLong),
        // A maxed-out session permanently refuses more turns: a business-rule refusal, not a resolvable conflict
        DefenseTurnLimitException => (StatusCodes.Status422UnprocessableEntity, ApiErrorCode.DefenseTurnLimit),
        // The per-user daily spend ceiling clears at the next midnight, so retrying later succeeds: retry-after semantics
        DefenseSpendLimitException => (StatusCodes.Status429TooManyRequests, ApiErrorCode.DefenseSpendLimit),

        // Forbidden actions — the caller is known, they're just not allowed
        NotCommentAuthorException => (StatusCodes.Status403Forbidden, ApiErrorCode.NotCommentAuthor),
        ListAccessDeniedException => (StatusCodes.Status403Forbidden, ApiErrorCode.ListAccessDenied),

        // State conflicts
        CannotLikeOwnCommentException => (StatusCodes.Status409Conflict, ApiErrorCode.CannotLikeOwnComment),

        // Malformed requests
        ListReorderMismatchException => (StatusCodes.Status400BadRequest, ApiErrorCode.ListReorderMismatch),

        // Authentication required — the caller is anonymous and the view is gated
        FavoritesRequireAuthenticationException => (StatusCodes.Status401Unauthorized, ApiErrorCode.FavoritesRequireAuthentication),
        MarkStatusRequiresAuthenticationException => (StatusCodes.Status401Unauthorized, ApiErrorCode.MarkStatusRequiresAuthentication),
        UserNotResolvedException => (StatusCodes.Status401Unauthorized, ApiErrorCode.UserNotResolved),

        // Not a known business failure — treat as an unexpected fault
        _ => null
    };
}

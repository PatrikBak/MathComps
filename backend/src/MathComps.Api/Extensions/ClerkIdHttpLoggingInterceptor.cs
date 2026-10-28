using MathComps.Api.Constants;
using Microsoft.AspNetCore.HttpLogging;

namespace MathComps.Api.Extensions;

/// <summary>
/// An <see cref="IHttpLoggingInterceptor"/> putting the caller's Clerk id on the request line, for a caller who
/// signed in.
/// </summary>
public sealed class ClerkIdHttpLoggingInterceptor : IHttpLoggingInterceptor
{
    /// <inheritdoc />
    /// <remarks>
    /// Adds nothing, since the caller is only known once authentication has run inside the logging.
    /// </remarks>
    public ValueTask OnRequestAsync(HttpLoggingInterceptorContext logContext) =>
        // The request goes on as it is
        ValueTask.CompletedTask;

    /// <inheritdoc />
    public ValueTask OnResponseAsync(HttpLoggingInterceptorContext logContext)
    {
        // The caller's Clerk id, which a request without a valid token doesn't carry
        var clerkId = logContext.HttpContext.User.FindFirst(ClerkClaims.Subject)?.Value;

        // Name the caller on the line. An anonymous caller adds nothing, so a route logging no fields writes no line.
        if (clerkId is not null)
            logContext.AddParameter("ClerkId", clerkId);

        // Nothing to wait for
        return ValueTask.CompletedTask;
    }
}

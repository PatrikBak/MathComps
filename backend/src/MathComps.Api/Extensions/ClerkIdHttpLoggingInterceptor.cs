using Microsoft.AspNetCore.HttpLogging;

namespace MathComps.Api.Extensions;

/// <summary>
/// An <see cref="IHttpLoggingInterceptor"/> putting the Clerk id of the account a request acts for on its request line.
/// </summary>
public sealed class ClerkIdHttpLoggingInterceptor : IHttpLoggingInterceptor
{
    /// <inheritdoc />
    /// <remarks>
    /// Adds nothing, since the caller is only known once authentication and the endpoint have run inside the logging.
    /// </remarks>
    public ValueTask OnRequestAsync(HttpLoggingInterceptorContext logContext) =>
        // The request goes on as it is
        ValueTask.CompletedTask;

    /// <inheritdoc />
    public ValueTask OnResponseAsync(HttpLoggingInterceptorContext logContext)
    {
        // The Clerk id of the account the request acted for, which an anonymous request doesn't carry
        var clerkId = logContext.HttpContext.CallerClerkId;

        // Name the caller on the line. An anonymous caller adds nothing, so a route logging no fields writes no line.
        if (clerkId is not null)
            logContext.AddParameter("ClerkId", clerkId);

        // Nothing to wait for
        return ValueTask.CompletedTask;
    }
}

using MathComps.Api.Constants;
using Sentry.Extensibility;

namespace MathComps.Api.Extensions;

/// <summary>
/// An <see cref="ISentryEventProcessor"/> naming the signed-in caller on an error a request reports, by the Clerk id
/// the website's events carry too, so one student's errors match between the website and the API. The id is all that
/// goes.
/// </summary>
/// <param name="httpContextAccessor">Access to the request the error happens in.</param>
public sealed class ClerkIdSentryEventProcessor(IHttpContextAccessor httpContextAccessor) : ISentryEventProcessor
{
    /// <inheritdoc />
    /// <remarks>
    /// An error outside a request, or in one without a valid token, keeps the user the SDK gives it.
    /// </remarks>
    public SentryEvent Process(SentryEvent @event)
    {
        // The caller's Clerk id, absent outside a request and from one without a valid token
        var clerkId = httpContextAccessor.HttpContext?.User.FindFirst(ClerkClaims.Subject)?.Value;

        // Name the caller by their Clerk id alone
        if (clerkId is not null)
            @event.User = new SentryUser { Id = clerkId };

        // The event goes on
        return @event;
    }
}

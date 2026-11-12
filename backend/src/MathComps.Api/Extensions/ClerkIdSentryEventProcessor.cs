using Sentry.Extensibility;

namespace MathComps.Api.Extensions;

/// <summary>
/// An <see cref="ISentryEventProcessor"/> naming the account a request acts for on an error it reports, by the Clerk id
/// the website's events carry too, so one student's errors match between the website and the API. The id is all that
/// goes.
/// </summary>
/// <param name="httpContextAccessor">Access to the request the error happens in.</param>
public sealed class ClerkIdSentryEventProcessor(IHttpContextAccessor httpContextAccessor) : ISentryEventProcessor
{
    /// <inheritdoc />
    /// <remarks>
    /// An error outside a request, or in an anonymous one, keeps the user the SDK gives it.
    /// </remarks>
    public SentryEvent Process(SentryEvent @event)
    {
        // The Clerk id of the account the request acts for, absent outside a request and from an anonymous one
        var clerkId = httpContextAccessor.HttpContext?.CallerClerkId;

        // Name the caller by their Clerk id alone
        if (clerkId is not null)
            @event.User = new SentryUser { Id = clerkId };

        // The event goes on
        return @event;
    }
}

using MathComps.Api.Constants;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Localization;
using Sentry.Extensibility;

namespace MathComps.Api.Extensions;

/// <summary>
/// An <see cref="ISentryEventProcessor"/> tagging an error with the request it happened in: who sent it, the route,
/// the language and whether an admin asked. It names the account the request acts for by the Clerk id the website's
/// events carry too, so one student's errors match between the website and the API, and the id is all that goes.
/// </summary>
/// <param name="httpContextAccessor">Access to the request the error happens in.</param>
public sealed class RequestContextSentryEventProcessor(IHttpContextAccessor httpContextAccessor) : ISentryEventProcessor
{
    /// <summary>
    /// The tag naming who sent the request an error happened in, one of the kinds <see cref="CallerKind"/> names.
    /// </summary>
    public const string CallerTag = "caller";

    /// <inheritdoc />
    /// <remarks>
    /// The SDK runs this for errors inside a request only. An anonymous request's error keeps the user the SDK gives
    /// it.
    /// </remarks>
    public SentryEvent Process(SentryEvent @event)
    {
        // The request the error happened in
        var context = httpContextAccessor.HttpContext;

        // Without one there is nothing to tell
        if (context is null)
            return @event;

        // Who sent the request
        @event.SetTag(CallerTag, CallerKind.Of(context.Request.Headers.UserAgent.ToString()));

        // Whether an admin sent it
        @event.SetTag("admin", context.User.IsInRole(ClerkClaims.AdminRole) ? "true" : "false");

        // The route the request matched, kept on the exception handler's feature once the handler clears it
        var endpoint = context.GetEndpoint() ?? context.Features.Get<IExceptionHandlerFeature>()?.Endpoint;

        // Tagged by its pattern, so one route's errors group whatever their slugs
        if (endpoint is RouteEndpoint { RoutePattern.RawText: { } route })
            @event.SetTag("route", route);

        // The language the request asked for, as the API resolved it
        var language = context.Features.Get<IRequestCultureFeature>()?.RequestCulture.UICulture.Name;

        // Tagged when the request went through localization
        if (language is not null)
            @event.SetTag("language", language);

        // The Clerk id of the account the request acts for, absent from an anonymous one
        var clerkId = context.CallerClerkId;

        // Name the caller by their Clerk id alone
        if (clerkId is not null)
            @event.User = new SentryUser { Id = clerkId };

        // The event goes on
        return @event;
    }
}

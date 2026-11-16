using MathComps.Api.Extensions;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.AspNetCore.Routing.Patterns;

namespace MathComps.Api.Tests;

/// <summary>
/// Covers <see cref="RequestContextSentryEventProcessor"/>. A student's error goes to a third party, so anything beyond
/// the id riding along would send their account details out with every fault. The error channel's alerts are picked
/// by the <c>caller</c> tag, so an error carrying the wrong one would go silent or ping for a script.
/// </summary>
public class RequestContextSentryEventProcessorTests
{
    /// <summary>
    /// An error a signed-in student's request reports names them by their Clerk id, and carries nothing else about
    /// them.
    /// </summary>
    [Fact]
    public void A_signed_in_callers_error_carries_their_Clerk_id_alone()
    {
        // A request from a signed-in student
        var request = new DefaultHttpContext { User = TestCallers.SignedIn("ext-student", isAdmin: false) };

        // An error the request reports, passed through the processor
        var processed = ErrorOf(request);

        // The student's id, and no name, address or IP beside it
        Assert.Equal("ext-student", processed.User.Id);
        Assert.Null(processed.User.Username);
        Assert.Null(processed.User.Email);
        Assert.Null(processed.User.IpAddress);
    }

    /// <summary>
    /// An error tells who sent its request by the User-Agent: the website's own server, a webhook's sender, a crawler,
    /// a script or a browser a script drives, and a visitor's browser.
    /// </summary>
    /// <param name="userAgent">The request's User-Agent.</param>
    /// <param name="caller">The caller the error is tagged with.</param>
    [Theory]
    [InlineData("node", "website")]
    [InlineData("Svix-Webhooks/1.84.0 (sender-AbC12; +https://www.svix.com/http-sender/)", "webhook")]
    [InlineData("curl/8.7.1", "script")]
    [InlineData("", "script")]
    [InlineData(
        "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) " +
        "Chrome/153.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        "crawler")]
    [InlineData(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) " +
        "HeadlessChrome/151.0.0.0 Safari/537.36",
        "script")]
    [InlineData(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:159.0) Gecko/20100101 Firefox/159.0",
        "browser")]
    public void An_error_is_tagged_with_who_sent_its_request(string userAgent, string caller)
    {
        // A request sent under the agent
        var request = new DefaultHttpContext();
        request.Request.Headers.UserAgent = userAgent;

        // An error the request reports, passed through the processor
        var processed = ErrorOf(request);

        // Tagged with the caller the agent names
        Assert.Equal(caller, processed.Tags["caller"]);
    }

    /// <summary>
    /// An error the exception handler reports names the route the request matched, though the handler clears the route
    /// from the request and keeps it only on its own feature.
    /// </summary>
    [Fact]
    public void A_handled_error_carries_the_route_its_request_matched()
    {
        // The route a request matched before its endpoint threw
        var endpoint = new RouteEndpoint(
            _ => Task.CompletedTask,
            RoutePatternFactory.Parse("/competitions/{competitionSlug}/results"),
            order: 0,
            EndpointMetadataCollection.Empty,
            displayName: null);

        // The request as the exception handler sees it: no endpoint of its own, the matched one on its feature
        var request = new DefaultHttpContext();
        request.Features.Set<IExceptionHandlerFeature>(
            new ExceptionHandlerFeature { Error = new InvalidOperationException(), Path = "/", Endpoint = endpoint });

        // An error the handler reports, passed through the processor
        var processed = ErrorOf(request);

        // Tagged by the route's pattern
        Assert.Equal("/competitions/{competitionSlug}/results", processed.Tags["route"]);
    }

    /// <summary>
    /// Runs an error a request reports through the processor.
    /// </summary>
    /// <param name="request">The request the error happened in.</param>
    /// <returns>The error, as it leaves.</returns>
    private static SentryEvent ErrorOf(HttpContext request) =>
        // A fresh error, passed through the processor reading the request
        new RequestContextSentryEventProcessor(new HttpContextAccessor { HttpContext = request })
            .Process(new SentryEvent());
}

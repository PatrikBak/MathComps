using System.Net;
using System.Text.Json;
using MathComps.Api.Constants;
using MathComps.Api.Errors;
using MathComps.Api.Extensions;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace MathComps.Api.Tests;

/// <summary>
/// Covers how the API's rate limiting tells one client from another, and how it answers a request it refuses. A limit
/// counts per client, so a key splitting one client into several lets it rotate addresses past every limit. A refusal
/// missing its code shows the caller a generic error instead of telling them to wait.
/// </summary>
public class RateLimitingTests
{
    /// <summary>
    /// Two addresses count against one limit exactly when they are one client. An IPv6 caller controls its whole /64,
    /// so the host half is ignored while the next /64 over is somebody else. An IPv4 caller is its one address, and
    /// arriving as an IPv4-mapped IPv6 address it is the same caller as its plain IPv4 form.
    /// </summary>
    /// <param name="first">The address spending the one request the window allows.</param>
    /// <param name="second">The address asking next.</param>
    /// <param name="expectedStatus">What the second address gets: refused when the two share a limit, let through
    /// otherwise.</param>
    [Theory]
    [InlineData("2001:db8:0:1::1", "2001:db8:0:1:ffff:ffff:ffff:ffff", StatusCodes.Status429TooManyRequests)]
    [InlineData("2001:db8:0:1::1", "2001:db8:0:2::1", StatusCodes.Status200OK)]
    [InlineData("192.0.2.1", "::ffff:192.0.2.1", StatusCodes.Status429TooManyRequests)]
    [InlineData("192.0.2.1", "192.0.2.2", StatusCodes.Status200OK)]
    public async Task Two_addresses_share_a_limit_exactly_when_they_are_one_client(
        string first, string second, int expectedStatus)
    {
        // A route allowing one request a window
        await using var route = LimitedRoute.Create();

        // The first address spends the one request
        await route.SendAsync(first);

        // The second address asks
        var response = await route.SendAsync(second);

        // Refused exactly when both count against one limit
        Assert.Equal(expectedStatus, response.StatusCode);
    }

    /// <summary>
    /// A refused request is answered 429, its problem body naming <see cref="ApiErrorCode.RateLimited"/> as the error
    /// code.
    /// </summary>
    [Fact]
    public async Task A_refused_request_is_answered_429_with_the_RateLimited_code()
    {
        // A route allowing one request a window
        await using var route = LimitedRoute.Create();

        // One caller spends the one request
        await route.SendAsync("192.0.2.1");

        // The same caller asks again
        var response = await route.SendAsync("192.0.2.1");

        // Refused as too many requests
        Assert.Equal(StatusCodes.Status429TooManyRequests, response.StatusCode);

        // The problem body the refusal carries
        using var body = await JsonDocument.ParseAsync(response.Body);

        // ...naming the limit as the reason
        Assert.Equal(nameof(ApiErrorCode.RateLimited), body.RootElement.GetProperty("errorCode").GetString());
    }

    /// <summary>
    /// One route under the API's general limit, behind a pipeline holding nothing but the rate limiter, with every
    /// limit at one request a window.
    /// </summary>
    /// <param name="services">The services the rate limiting is registered into.</param>
    /// <param name="pipeline">The rate limiter in front of a route answering 200.</param>
    private sealed class LimitedRoute(ServiceProvider services, RequestDelegate pipeline) : IAsyncDisposable
    {
        /// <summary>
        /// The route, carrying the general limit's policy the way a mapped route requiring it does.
        /// </summary>
        private static readonly Endpoint _endpoint = new(
            null,
            new EndpointMetadataCollection(new EnableRateLimitingAttribute(RateLimiterPolicies.ApiRateLimit)),
            "A route under the general limit");

        /// <summary>
        /// Registers the rate limiting the way the API does and builds the pipeline in front of the route.
        /// </summary>
        /// <returns>The route, with no request counted yet.</returns>
        public static LimitedRoute Create()
        {
            // Every limit the settings require at one request an hour, so no window ends mid-test, and no queue on the
            // route's own limit, so a request past it is refused at once
            var configuration = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["RateLimits:Window"] = "01:00:00",
                    ["RateLimits:ApiPermitLimit"] = "1",
                    ["RateLimits:ApiQueueLimit"] = "0",
                    ["RateLimits:SearchPermitLimit"] = "1",
                    ["RateLimits:AccountPollPermitLimit"] = "1",
                    ["RateLimits:AddressPollPermitLimit"] = "1",
                })
                .Build();

            // The rate limiting as the API registers it, writing problem bodies the way the API does
            var services = new ServiceCollection()
                .AddLogging()
                .AddProblemDetails()
                .AddRateLimiting(configuration)
                .BuildServiceProvider();

            // A pipeline built over the services
            var app = new ApplicationBuilder(services);

            // The rate limiter first
            app.UseRateLimiter();

            // Then the route, answering 200 to every request the rate limiter lets through
            app.Run(_ => Task.CompletedTask);

            // The route behind its built pipeline
            return new LimitedRoute(services, app.Build());
        }

        /// <summary>
        /// Sends a request to the route from an address.
        /// </summary>
        /// <param name="address">The address the request comes from.</param>
        /// <returns>The response, its body read from the start.</returns>
        public async Task<HttpResponse> SendAsync(string address)
        {
            // The request from the address, with an empty response body for the answer
            var request = new DefaultHttpContext
            {
                RequestServices = services,
                Connection = { RemoteIpAddress = IPAddress.Parse(address) },
                Response = { Body = new MemoryStream() },
            };

            // Bound for the route
            request.SetEndpoint(_endpoint);

            // Through the pipeline
            await pipeline(request);

            // The answer, ready to read from its start
            request.Response.Body.Position = 0;

            // The response
            return request.Response;
        }

        /// <inheritdoc/>
        public ValueTask DisposeAsync() =>
            // Release the services
            services.DisposeAsync();
    }
}

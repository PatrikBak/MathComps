using System.Net;
using System.Net.Sockets;
using System.Threading.RateLimiting;
using MathComps.Api.Authorization;
using MathComps.Api.Constants;
using MathComps.Api.Errors;
using MathComps.Api.Options;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;
using System.Text.RegularExpressions;

namespace MathComps.Api.Extensions;

/// <summary>
/// Extension methods for configuring services in the dependency injection container.
/// </summary>
public static class ServiceCollectionExtensions
{
    /// <summary>
    /// Adds rate limiting services to prevent DoS attacks and abuse, sized by the limits in configuration.
    /// </summary>
    /// <param name="services">The service collection to configure.</param>
    /// <param name="configuration">The application configuration carrying the <c>RateLimits</c> section.</param>
    /// <returns>The configured service collection for chaining.</returns>
    public static IServiceCollection AddRateLimiting(this IServiceCollection services, IConfiguration configuration)
    {
        // The limits, checked at startup
        services.AddOptions<RateLimitSettings>()
            .Bind(configuration.GetSection(RateLimitSettings.SectionName))
            .ValidateDataAnnotations()
            .ValidateOnStart();

        // How a refused request is answered
        services.AddRateLimiter(options =>
        {
            // Reject over-limit requests with 429 (Too Many Requests)
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

            // Give the rejection the same coded problem body an endpoint failure carries
            options.OnRejected = async (rejectedContext, _) =>
            {
                // Resolve the problem writer for this request
                var problemDetailsService = rejectedContext.HttpContext.RequestServices
                    .GetRequiredService<IProblemDetailsService>();

                // Write our coded 429
                await ProblemResponseWriter.WriteAsync(
                    problemDetailsService,
                    rejectedContext.HttpContext,
                    StatusCodes.Status429TooManyRequests,
                    nameof(ApiErrorCode.RateLimited),
                    "You have made too many requests. Please try again shortly.");
            };
        });

        // The policies, sized by the limits
        services.AddOptions<RateLimiterOptions>()
            .Configure<IOptions<RateLimitSettings>>((options, rateLimitSettings) =>
            {
                // The limits as bound
                var settings = rateLimitSettings.Value;

                // General API rate limiting, one bucket per address
                options.AddPolicy(
                    RateLimiterPolicies.ApiRateLimit,
                    PartitionByAddress(settings.ApiPermitLimit, settings.ApiQueueLimit, settings.Window));

                // A limit of its own for search endpoints (heavier operations), one bucket per address
                options.AddPolicy(
                    RateLimiterPolicies.SearchRateLimit,
                    PartitionByAddress(settings.SearchPermitLimit, settings.SearchQueueLimit, settings.Window));

                // A limit of its own for routes a signed-in page asks every few seconds, one bucket per account
                options.AddPolicy(
                    RateLimiterPolicies.AccountPollRateLimit,
                    PartitionByAccount(
                        settings.AccountPollPermitLimit, settings.AccountPollQueueLimit, settings.Window));

                // A limit of its own for routes a page with no account asks every few seconds, one bucket per address
                options.AddPolicy(
                    RateLimiterPolicies.AddressPollRateLimit,
                    PartitionByAddress(
                        settings.AddressPollPermitLimit, settings.AddressPollQueueLimit, settings.Window));
            });

        // Return the services for chaining
        return services;
    }

    /// <summary>
    /// Builds a per-address fixed-window rate limiting partitioner keyed on the request's client IP.
    /// </summary>
    /// <param name="permitLimit">Requests allowed per address within the window.</param>
    /// <param name="queueLimit">Requests held per address once the limit is hit before rejection.</param>
    /// <param name="window"><inheritdoc cref="RateLimitSettings.Window" path="/summary"/></param>
    /// <returns>A partitioner producing one fixed-window limiter per client IP.</returns>
    private static Func<HttpContext, RateLimitPartition<string>> PartitionByAddress(
        int permitLimit, int queueLimit, TimeSpan window) =>
        // Key on the caller's IP, collapsed to a stable per-client value
        PartitionBy(
            httpContext => ClientPartitionKey(httpContext.Connection.RemoteIpAddress), permitLimit, queueLimit, window);

    /// <summary>
    /// Builds a per-account fixed-window rate limiting partitioner keyed on the signed-in caller, so callers sharing an
    /// address (a school's network) don't share a limit. The account is read off a token already validated, so a
    /// caller can't make one up for a fresh limit. A request with no account falls back on its client IP.
    /// </summary>
    /// <param name="permitLimit">Requests allowed per account within the window.</param>
    /// <param name="queueLimit">Requests held per account once the limit is hit before rejection.</param>
    /// <param name="window"><inheritdoc cref="RateLimitSettings.Window" path="/summary"/></param>
    /// <returns>A partitioner producing one fixed-window limiter per account.</returns>
    private static Func<HttpContext, RateLimitPartition<string>> PartitionByAccount(
        int permitLimit, int queueLimit, TimeSpan window) =>
        // Key on the caller's Clerk id, and on their IP when they have none
        PartitionBy(
            httpContext => httpContext.User.ClerkId ?? ClientPartitionKey(httpContext.Connection.RemoteIpAddress),
            permitLimit,
            queueLimit,
            window);

    /// <summary>
    /// Builds a fixed-window rate limiting partitioner, one limiter per key.
    /// </summary>
    /// <param name="keyOf">Reads which bucket a request counts against.</param>
    /// <param name="permitLimit">Requests allowed per key within the window.</param>
    /// <param name="queueLimit">Requests held per key once the limit is hit before rejection.</param>
    /// <param name="window"><inheritdoc cref="RateLimitSettings.Window" path="/summary"/></param>
    /// <returns>A partitioner producing one fixed-window limiter per key.</returns>
    private static Func<HttpContext, RateLimitPartition<string>> PartitionBy(
        Func<HttpContext, string> keyOf, int permitLimit, int queueLimit, TimeSpan window) =>
        // Partition each request by its key so the limit applies per bucket
        httpContext => RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: keyOf(httpContext),
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = permitLimit,
                Window = window,
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = queueLimit,
            });

    /// <summary>
    /// Derives a stable per-client rate-limiting key from a request's remote address.
    /// </summary>
    /// <param name="address">The client address, or <c>null</c> when it can't be determined.</param>
    /// <returns>
    /// The IPv4 address verbatim, the /64 network prefix for IPv6, or <c>unknown</c> when there is no
    /// address.
    /// </returns>
    private static string ClientPartitionKey(IPAddress? address)
    {
        // No address — bucket every such request together
        if (address is null)
            return "unknown";

        // Unwrap IPv4-mapped IPv6 so a mapped client keys the same as its plain IPv4 form
        if (address.IsIPv4MappedToIPv6)
            address = address.MapToIPv4();

        // A single IPv4 address already identifies one client
        if (address.AddressFamily != AddressFamily.InterNetworkV6)
            return address.ToString();

        // An IPv6 client controls a whole /64, so collapse to that prefix to stop address rotation
        var bytes = address.GetAddressBytes();
        // Zero the host half, keeping only the /64 network prefix
        Array.Clear(bytes, 8, 8);
        // Rebuild the address from the masked prefix and use it as the key
        return new IPAddress(bytes).ToString();
    }

    /// <summary>
    /// Adds the authorization policies endpoints require, and what looks the caller's account up on an organization's
    /// list.
    /// </summary>
    /// <param name="services">The service collection to configure.</param>
    /// <returns>The configured service collection for chaining.</returns>
    public static IServiceCollection AddApiAuthorization(this IServiceCollection services)
    {
        // The policies, each by the accounts it lets in
        services.AddAuthorizationBuilder()
            .AddPolicy(AuthorizationPolicies.Admin, policy => policy.RequireRole(ClerkClaims.AdminRole))
            .AddPolicy(AuthorizationPolicies.OrganizationMember, policy => policy
                .RequireAuthenticatedUser()
                .AddRequirements(new OrganizationMemberRequirement()));

        // What looks the caller's account up on an organization's list
        services.AddScoped<IAuthorizationHandler, OrganizationMemberHandler>();

        // Return the services for chaining
        return services;
    }

    /// <summary>
    /// Adds CORS configuration for cross-origin requests.
    /// </summary>
    /// <param name="services">The service collection to configure.</param>
    /// <param name="configuration">The application configuration containing CORS settings.</param>
    /// <returns>The configured service collection for chaining.</returns>
    public static IServiceCollection AddCorsConfiguration(this IServiceCollection services, IConfiguration configuration)
    {
        // Configure Cors
        services.AddCors(options => options
            // With one policy, more than enough
            .AddPolicy("default", policyBuilder => policyBuilder
                // Custom origin validation to support wildcards
                .SetIsOriginAllowed(origin =>
                     // Get allowed origins from configuration
                     (configuration.GetSection("Cors:Origins").Get<string[]>() ?? [])
                         // Convert wildcard patterns to regex patterns
                         .Select(allowedOrigin =>
                             // Escape special regex characters first, then replace * with .*
                             $"^{Regex.Escape(allowedOrigin).Replace("\\*", ".*")}$")
                        // Check if the origin matches any of the regex patterns
                        .Any(pattern => Regex.IsMatch(origin, pattern, RegexOptions.IgnoreCase)))
                // Allow common headers for browser requests
                .WithHeaders("Content-Type", "X-Requested-With", "Authorization", "Accept", "Accept-Language")
                // Only required HTTP methods
                .WithMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
            )
        );

        // Return the services for chaining
        return services;
    }
}

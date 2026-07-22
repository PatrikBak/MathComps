using System.Net;
using System.Net.Sockets;
using System.Threading.RateLimiting;
using MathComps.Api.Constants;
using MathComps.Api.Errors;
using System.Text.RegularExpressions;

namespace MathComps.Api.Extensions;

/// <summary>
/// Extension methods for configuring services in the dependency injection container.
/// </summary>
public static class ServiceCollectionExtensions
{
    /// <summary>
    /// Adds rate limiting services to prevent DoS attacks and abuse.
    /// </summary>
    /// <param name="services">The service collection to configure.</param>
    /// <returns>The configured service collection for chaining.</returns>
    public static IServiceCollection AddRateLimiting(this IServiceCollection services)
    {
        // Configure policies
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
                    ApiErrorCode.RateLimited,
                    "You have made too many requests. Please try again shortly.");
            };

            // General API rate limiting, one bucket per caller
            options.AddPolicy(RateLimiterPolicies.ApiRateLimit, PartitionByCaller(permitLimit: 60, queueLimit: 10));

            // More restrictive limit for search endpoints (heavier operations), one bucket per caller
            options.AddPolicy(RateLimiterPolicies.SearchRateLimit, PartitionByCaller(permitLimit: 20, queueLimit: 5));

            // Tight limit for defense turns — each is several LLM calls, so bound bursts hard
            options.AddPolicy(RateLimiterPolicies.DefenseTurnRateLimit, PartitionByCaller(permitLimit: 10, queueLimit: 2));
        });

        // Return the services for chaining
        return services;
    }

    /// <summary>
    /// Builds a per-caller fixed-window rate limiting partitioner keyed on the request's client IP.
    /// </summary>
    /// <param name="permitLimit">Requests allowed per caller within the window.</param>
    /// <param name="queueLimit">Requests held per caller once the limit is hit before rejection.</param>
    /// <returns>A partitioner producing one fixed-window limiter per client IP.</returns>
    private static Func<HttpContext, RateLimitPartition<string>> PartitionByCaller(int permitLimit, int queueLimit)
    {
        // Partition each request by its client so the limit applies per visitor
        return httpContext => RateLimitPartition.GetFixedWindowLimiter(
            // Key on the caller's IP, collapsed to a stable per-client value
            partitionKey: ClientPartitionKey(httpContext.Connection.RemoteIpAddress),
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = permitLimit,
                Window = TimeSpan.FromMinutes(1),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = queueLimit,
            });
    }

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

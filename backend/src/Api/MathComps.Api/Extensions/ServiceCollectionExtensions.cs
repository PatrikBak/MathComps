using Microsoft.AspNetCore.RateLimiting;
using System.Threading.RateLimiting;
using MathComps.Api.Constants;

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
            // General API rate limiting
            options.AddFixedWindowLimiter(RateLimiterPolicies.ApiRateLimit, rateLimiterOptions =>
            {
                rateLimiterOptions.PermitLimit = 60;
                rateLimiterOptions.Window = TimeSpan.FromMinutes(1);
                rateLimiterOptions.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
                rateLimiterOptions.QueueLimit = 10;
            });

            // More restrictive limit for search endpoints (heavier operations)
            options.AddFixedWindowLimiter(RateLimiterPolicies.SearchRateLimit, rateLimiterOptions =>
            {
                rateLimiterOptions.PermitLimit = 20;
                rateLimiterOptions.Window = TimeSpan.FromMinutes(1);
                rateLimiterOptions.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
                rateLimiterOptions.QueueLimit = 5;
            });
        });

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
                // Get the allowed hosts from the config
                .WithOrigins(configuration.GetSection("Cors:Origins").Get<string[]>() ?? [])
                // Allow common headers for browser requests
                .WithHeaders("Content-Type", "X-Requested-With")
                // Only required HTTP methods
                .WithMethods("GET", "POST", "OPTIONS")
            )
        );

        // Return the services for chaining
        return services;
    }
}

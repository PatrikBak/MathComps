using System.Text.RegularExpressions;

namespace MathComps.Api.Extensions;

/// <summary>
/// Extension methods for configuring CORS.
/// </summary>
public static class CorsExtensions
{
    /// <summary>
    /// Adds the API's one CORS policy, which lets in the browser origins configuration lists, a <c>*</c> in one
    /// matching any run of characters.
    /// </summary>
    /// <param name="services">The service collection to configure.</param>
    /// <param name="configuration">The application configuration containing CORS settings.</param>
    /// <returns>The configured service collection for chaining.</returns>
    public static IServiceCollection AddCorsConfiguration(this IServiceCollection services, IConfiguration configuration)
    {
        // Let browsers on the configured origins call the API
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

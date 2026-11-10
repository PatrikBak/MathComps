using System.Text.RegularExpressions;
using MathComps.Api.Options;
using Microsoft.AspNetCore.Cors.Infrastructure;
using Microsoft.Extensions.Options;

namespace MathComps.Api.Extensions;

/// <summary>
/// Extension methods for configuring CORS.
/// </summary>
public static class CorsExtensions
{
    /// <summary>
    /// Adds the API's one CORS policy, which lets in the browser origins <see cref="CorsSettings.Origins"/> lists.
    /// </summary>
    /// <param name="services">The service collection to configure.</param>
    /// <param name="configuration">The application configuration carrying the <c>Cors</c> section.</param>
    /// <returns>The configured service collection for chaining.</returns>
    public static IServiceCollection AddCorsConfiguration(this IServiceCollection services, IConfiguration configuration)
    {
        // The allowed origins
        services.AddOptions<CorsSettings>()
            .Bind(configuration.GetSection(CorsSettings.SectionName));

        // Handling for browsers' cross-origin requests
        services.AddCors();

        // The policy, built from the allowed origins
        services.AddOptions<CorsOptions>()
            .Configure<IOptions<CorsSettings>>((options, corsSettings) =>
            {
                // Each allowed origin as a pattern matching that origin alone, its wildcards included
                var originPatterns = corsSettings.Value.Origins
                    .Select(allowedOrigin => new Regex(
                        $"^{Regex.Escape(allowedOrigin).Replace("\\*", ".*")}$", RegexOptions.IgnoreCase))
                    .ToList();

                // The policy every request gets
                options.AddDefaultPolicy(policyBuilder => policyBuilder
                    // Let in an origin matching any allowed pattern
                    .SetIsOriginAllowed(origin => originPatterns.Any(pattern => pattern.IsMatch(origin)))
                    // Allow common headers for browser requests
                    .WithHeaders("Content-Type", "X-Requested-With", "Authorization", "Accept", "Accept-Language")
                    // Only required HTTP methods
                    .WithMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
            });

        // Return the services for chaining
        return services;
    }
}

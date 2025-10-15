using MathComps.Infrastructure.Options;
using MathComps.Infrastructure.Services;
using Microsoft.Extensions.DependencyInjection;

namespace MathComps.Infrastructure;

/// <summary>
/// Provides extension methods for setting up dependency injection for infrastructure services.
/// </summary>
public static class DependencyInjectionHelpers
{
    /// <summary>
    /// Adds services that use DB, with their options.
    /// </summary>
    /// <param name="services">The <see cref="IServiceCollection"/> to add the services to.</param>
    /// <returns>The <see cref="IServiceCollection"/> so that additional calls can be chained.</returns>
    public static IServiceCollection AddInfrastructureServices(this IServiceCollection services)
    {
        // The options for pagination 
        services.AddOptions<PaginationOptions>()
            .BindConfiguration(PaginationOptions.ConfigurationSectionName)
            .Validate(options => options.MaxPageSize > 0, $"{nameof(PaginationOptions.MaxPageSize)} must be > 0.")
            .Validate(options => options.DefaultPageSize > 0, $"{nameof(PaginationOptions.DefaultPageSize)} must be > 0.")
            .Validate(options => options.DefaultPageSize <= options.MaxPageSize, $"{nameof(PaginationOptions.DefaultPageSize)} cannot be > {nameof(PaginationOptions.MaxPageSize)}.");

        // The options for similarity
        services.AddOptions<SimilarityOptions>()
            .BindConfiguration(SimilarityOptions.ConfigurationSectionName)
            .Validate(options => options.MaxSimilarProblems >= 0, $"{nameof(SimilarityOptions.MaxSimilarProblems)} must >= 0.")
            .Validate(options => options.MinSimilarityScore is >= 0 and <= 1, $"{nameof(SimilarityOptions.MinSimilarityScore)} must be between 0 and 1.");

        // DB service
        services.AddScoped<IProblemFilterService, ProblemFilterService>();
        services.AddScoped<IProblemLookupService, ProblemLookupService>();

        // Return the services for chaining
        return services;
    }
}

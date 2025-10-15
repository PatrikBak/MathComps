using MathComps.Domain.ApiDtos.Helpers;
using MathComps.Domain.ApiDtos.ProblemQuery;
using MathComps.Domain.ApiDtos.SearchBar;
using MathComps.Infrastructure.Services;
using MathComps.Api.Constants;

namespace MathComps.Api.Extensions;

/// <summary>
/// Extension methods for mapping API endpoints.
/// </summary>
public static class EndpointExtensions
{
    /// <summary>
    /// Maps all API endpoints for the MathComps application.
    /// </summary>
    /// <param name="app">The web application to configure.</param>
    /// <returns>The configured web application for chaining.</returns>
    public static WebApplication MapApiEndpoints(this WebApplication app)
    {
        // The endpoint for doing problem archive filtering
        app.MapPost("/problems/filter", async (FilterQuery query, IProblemFilterService problemService) =>
        {
            // Just call the service
            var response = await problemService.FilterAsync(query);

            // We're happy
            return Results.Ok(response);
        })
        // Apply search-specific rate limiting
        .RequireRateLimiting(RateLimiterPolicies.SearchRateLimit);

        // The endpoint for getting the data for a filter
        app.MapGet("/problems/{slug}", async (string slug, IProblemLookupService lookupService, IProblemFilterService filterService) =>
        {
            // Get problem metadata to construct appropriate filters
            var lookupResult = await lookupService.GetProblemLookupDataAsync(slug);

            // This is sad
            if (lookupResult == null)
                return Results.NotFound(new { message = "Problem not found" });

            // Get the filters state
            var filters = new FilterParameters(
                SearchText: string.Empty,
                SearchInSolution: false,
                OlympiadYears: [lookupResult.Season],
                Contests: [new ContestSelection(lookupResult.CompetitionSlug, lookupResult.CategorySlug, lookupResult.RoundSlug)],
                ProblemNumbers: [lookupResult.ProblemNumber],
                TagSlugs: [],
                TagLogic: LogicToggle.Or,
                AuthorSlugs: [],
                AuthorLogic: LogicToggle.Or
            );

            // Use the existing filter service to get the results
            var response = await filterService.FilterAsync(new FilterQuery(filters, PageSize: 1, PageNumber: 1));

            // We're happy
            return Results.Ok(response);
        })
        // Apply standard rate limiting
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Add health check endpoint for monitoring
        app.MapHealthChecks("/health");

        // Return the app for chaining
        return app;
    }
}

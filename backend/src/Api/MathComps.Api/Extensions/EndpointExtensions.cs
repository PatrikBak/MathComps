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
        // Allows anonymous access but provides personalized data if authenticated
        app.MapPost("/problems/filter", async (FilterQuery query, HttpContext context, IUserManager userManager, IProblemFilterService problemService) =>
        {
            // Get user ID (optional)
            var userId = await GetUserIdAsync(context, userManager);

            // Create service options
            var options = new ProblemFilterOptions(query, userId);

            // Just call the service
            var response = await problemService.FilterAsync(options);

            // We're happy
            return Results.Ok(response);
        })
        // Apply search-specific rate limiting
        .RequireRateLimiting(RateLimiterPolicies.SearchRateLimit);

        // The endpoint for getting the data for a filter
        // Allows anonymous access but provides personalized data if authenticated
        app.MapGet("/problems/{slug}", async (string slug, HttpContext context, IUserManager userManager, IProblemLookupService lookupService, IProblemFilterService filterService) =>
        {
            // Get problem metadata to construct appropriate filters
            var lookupResult = await lookupService.GetProblemLookupDataAsync(slug);

            // This is sad
            if (lookupResult == null)
                return Results.NotFound(new { message = "Problem not found" });

            // Get user ID (optional)
            var userId = await GetUserIdAsync(context, userManager);

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

            // Construct filter options
            var filterOptions = new ProblemFilterOptions(
                new FilterQuery(
                    filters,
                    PageSize: 1,
                    PageNumber: 1,
                    FavoritesOnly: false
                ),
                userId
            );

            // Use the existing filter service to get the results
            var response = await filterService.FilterAsync(filterOptions);

            // We're happy
            return Results.Ok(response);
        })
        // Apply standard rate limiting
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // The endpoint for toggling a like on a problem
        app.MapPost("/problems/{slug}/like", async (
            string slug,
            HttpContext context,
            IUserManager userManager,
            IProblemLookupService problemLookupService,
            IUserProblemService userProblemService) =>
        {
            // Get user ID
            var userId = await GetUserIdAsync(context, userManager);

            // No user is very sus, let's say unauthorized
            if (userId == null)
                return Results.Unauthorized();

            // Get the internal problem ID
            var problemId = await problemLookupService.GetProblemIdBySlugAsync(slug);

            // Ensure the problem exists 
            if (problemId == null)
                return Results.NotFound(new { message = "Problem not found" });

            // Toggle like
            await userProblemService.ToggleLikeAsync(userId.Value, problemId.Value);

            // No reason to return anything?
            return Results.NoContent();
        })
        .RequireAuthorization()
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Add health check endpoint for monitoring
        app.MapHealthChecks("/health");

        // Return the app for chaining
        return app;
    }

    /// <summary>
    /// Extracts the internal user ID from the HTTP context if a user is authenticated.
    /// </summary>
    /// <param name="context">The HTTP context containing user claims.</param>
    /// <param name="userManager">User manager for resolving external to internal user IDs.</param>
    /// <returns>The internal user ID if authenticated, otherwise null.</returns>
    private static async Task<Guid?> GetUserIdAsync(HttpContext context, IUserManager userManager)
    {
        // Extract Clerk user ID from JWT claims
        var userExternalId = context.User.FindFirst("sub")?.Value;

        // If we have a user, get their internal ID
        return !string.IsNullOrEmpty(userExternalId)
            ? await userManager.GetUserIdAsync(userExternalId)
            : null;
    }
}

using MathComps.Api.Constants;
using MathComps.Domain.ApiDtos.Helpers;
using MathComps.Domain.ApiDtos.ProblemQuery;
using MathComps.Domain.ApiDtos.SearchBar;
using MathComps.Domain.ApiDtos.UserLists;
using MathComps.Infrastructure.Services.Problems;
using MathComps.Infrastructure.Services.Users;

namespace MathComps.Api.Endpoints;

/// <summary>
/// Maps the problem catalog endpoints — filtering, the contest browser, single-problem lookup, and the
/// like/mark toggles a signed-in user can apply to a problem.
/// </summary>
public static class ProblemEndpoints
{
    /// <summary>
    /// Maps the <c>/problems</c> endpoints onto the route builder.
    /// </summary>
    /// <param name="app">The route builder to register the endpoints on.</param>
    public static void MapProblemEndpoints(this IEndpointRouteBuilder app)
    {
        // The endpoint for doing problem archive filtering
        // Allows anonymous access but provides personalized data if authenticated
        app.MapPost("/problems/filter", async (FilterQuery query, HttpContext context, IUserManager userManager, IProblemFilterService problemService, IUserListService userListService) =>
        {
            // Get user ID (optional)
            var userId = await EndpointHelpers.GetUserIdAsync(context, userManager);

            // Track the list name for the response (populated when filtering by a specific list)
            string? listName = null;

            // If filtering by a specific list...
            if (query.ListContentId is not null)
            {
                // Check if the user can access the list
                var accessResult = await userListService.CheckListAccessAsync(userId, query.ListContentId);

                // Handle all access scenarios
                switch (accessResult.Status)
                {
                    // Bad list id
                    case ListAccessStatus.NotFound:
                        return Results.NotFound();

                    // User doesn't own this private list
                    case ListAccessStatus.NoAccess:
                        return Results.Unauthorized();

                    // User can access the list — capture the name for the response
                    case ListAccessStatus.HasAccess:
                        listName = accessResult.ListName;
                        break;

                    default:
                        throw new InvalidOperationException("Unexpected ListAccessStatus");
                }
            }

            // Detect language from Accept-Language header
            var language = EndpointHelpers.GetRequestLanguage();

            // Create service options
            var options = new ProblemFilterOptions(query, userId, language);

            // Delegate to service
            var filterResult = await problemService.FilterAsync(options);

            // Wrap with list metadata for the API response
            return Results.Ok(new ProblemFilterResponse(filterResult, listName));
        })
        // Apply search-specific rate limiting
        .RequireRateLimiting(RateLimiterPolicies.SearchRateLimit);

        // The endpoint for the contest browser - returns competitions grouped by season
        app.MapGet("/problems/contests-by-season", async (IProblemFilterService problemService) =>
        {
            // Detect language from Accept-Language header
            var language = EndpointHelpers.GetRequestLanguage();

            // Delegate to service
            return Results.Ok(await problemService.GetContestsBySeasonAsync(language));
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
            var userId = await EndpointHelpers.GetUserIdAsync(context, userManager);

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

            // Detect language from Accept-Language header
            var language = EndpointHelpers.GetRequestLanguage();

            // Create service options
            var filterOptions = new ProblemFilterOptions(
                new FilterQuery(
                    filters,
                    PageSize: 1,
                    PageNumber: 1,
                    FavoritesOnly: false
                ),
                userId,
                language
            );

            // Delegate to service
            return Results.Ok(await filterService.FilterAsync(filterOptions));
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
            var userId = await EndpointHelpers.GetUserIdAsync(context, userManager);

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

        // The endpoint for toggling a mark on a problem
        app.MapPost("/problems/{slug}/mark", async (
            string slug,
            HttpContext context,
            IUserManager userManager,
            IProblemLookupService problemLookupService,
            IUserProblemService userProblemService) =>
        {
            // Get user ID
            var userId = await EndpointHelpers.GetUserIdAsync(context, userManager);

            // No user is very sus, let's say unauthorized
            if (userId == null)
                return Results.Unauthorized();

            // Get the internal problem ID
            var problemId = await problemLookupService.GetProblemIdBySlugAsync(slug);

            // Ensure the problem exists
            if (problemId == null)
                return Results.NotFound(new { message = "Problem not found" });

            // Toggle mark
            await userProblemService.ToggleMarkAsync(userId.Value, problemId.Value);

            // No reason to return anything?
            return Results.NoContent();
        })
        .RequireAuthorization()
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);
    }
}

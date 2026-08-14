using MathComps.Api.Constants;
using MathComps.Domain.Contracts.Helpers;
using MathComps.Domain.Contracts.ProblemQuery;
using MathComps.Domain.Contracts.UserLists;
using MathComps.Infrastructure.Services.Problems;
using MathComps.Infrastructure.Services.Users;

namespace MathComps.Api.Endpoints;

/// <summary>
/// Maps the problem catalog endpoints — filtering, the competition browser, single-problem lookup, and the
/// like/mark toggles a signed-in user can apply to a problem.
/// </summary>
public static class ProblemEndpoints
{
    /// <summary>
    /// Base path the problem routes derive from.
    /// </summary>
    private const string ProblemsPath = "/problems";

    /// <summary>
    /// Maps the <c>/problems</c> endpoints onto the route builder.
    /// </summary>
    /// <param name="app">The route builder to register the endpoints on.</param>
    public static void MapProblemEndpoints(this IEndpointRouteBuilder app)
    {
        // The endpoint for doing problem archive filtering
        // Allows anonymous access but provides personalized data if authenticated
        app.MapPost($"{ProblemsPath}/filter", async (FilterQuery query, HttpContext context, IUserManager userManager, IProblemFilterService problemService, IUserListService userListService) =>
        {
            // Get user ID (optional)
            var userId = await userManager.GetUserIdAsync(context);

            // Track the list name for the response (populated when filtering by a specific list)
            string? listName = null;

            // If filtering by a specific list...
            if (query.ListContentId is not null)
            {
                // Check if the user can access the list
                var accessResult = await userListService.CheckListAccessAsync(userId, query.ListContentId);

                // Capture the accessible list's name, or fail with the mapped error
                listName = accessResult.Status switch
                {
                    // User can access the list — its name rides on the response
                    ListAccessStatus.HasAccess => accessResult.ListName,

                    // Bad list id
                    ListAccessStatus.NotFound => throw new ListNotFoundException(query.ListContentId),

                    // User doesn't own this private list
                    ListAccessStatus.NoAccess => throw new ListAccessDeniedException(query.ListContentId),

                    // The enum is closed; a new member is a bug
                    _ => throw new InvalidOperationException("Unexpected ListAccessStatus")
                };
            }

            // Detect language from Accept-Language header
            var language = EndpointHelpers.GetRequestLanguage();

            // The query alongside the context only the request itself can resolve
            var options = new ProblemFilterOptions(query, userId, language);

            // Delegate to service
            var filterResult = await problemService.FilterAsync(options);

            // Wrap with list metadata for the API response
            return Results.Ok(new ProblemFilterResponse(filterResult, listName));
        })
        // Apply search-specific rate limiting
        .RequireRateLimiting(RateLimiterPolicies.SearchRateLimit);

        // The endpoint for the competition browser - returns competitions grouped by season
        app.MapGet($"{ProblemsPath}/competitions-by-season", async (IProblemFilterService problemService) =>
        {
            // Detect language from Accept-Language header
            var language = EndpointHelpers.GetRequestLanguage();

            // Delegate to service
            return Results.Ok(await problemService.GetCompetitionsBySeasonAsync(language));
        })
        // Apply search-specific rate limiting
        .RequireRateLimiting(RateLimiterPolicies.SearchRateLimit);

        // The endpoint for getting the data for a filter
        // Allows anonymous access but provides personalized data if authenticated
        app.MapGet($"{ProblemsPath}/{{slug}}", async (
            string slug,
            bool includeBaseOptions,
            HttpContext context,
            IUserManager userManager,
            IProblemLookupService lookupService,
            IProblemFilterService filterService) =>
        {
            // Get problem metadata to construct appropriate filters
            var lookupResult = await lookupService.GetProblemLookupDataAsync(slug)
                // It must exist
                ?? throw new ProblemNotFoundException(slug);

            // Get user ID (optional)
            var userId = await userManager.GetUserIdAsync(context);

            // Get the filters state
            var filters = new FilterParameters(
                SearchText: string.Empty,
                SearchInSolution: false,
                OlympiadYears: [lookupResult.Season],
                CompetitionPaths: [lookupResult.CompetitionPath],
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
                    FavoritesOnly: false,
                    IncludeBaseOptions: includeBaseOptions
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
        app.MapPost($"{ProblemsPath}/{{slug}}/like", async (
            string slug,
            HttpContext context,
            IUserManager userManager,
            IProblemLookupService problemLookupService,
            IUserProblemService userProblemService) =>
        {
            // Resolve the caller, faulting when the request has no user behind it
            var userId = await userManager.RequireUserIdAsync(context);

            // Get the internal problem ID (throws if the problem doesn't exist)
            var problemId = await problemLookupService.GetRequiredProblemIdBySlugAsync(slug);

            // Toggle like
            await userProblemService.ToggleLikeAsync(userId, problemId);

            // No reason to return anything?
            return Results.NoContent();
        })
        .RequireAuthorization()
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // The endpoint for toggling a mark on a problem
        app.MapPost($"{ProblemsPath}/{{slug}}/mark", async (
            string slug,
            HttpContext context,
            IUserManager userManager,
            IProblemLookupService problemLookupService,
            IUserProblemService userProblemService) =>
        {
            // Resolve the caller, faulting when the request has no user behind it
            var userId = await userManager.RequireUserIdAsync(context);

            // Get the internal problem ID (throws if the problem doesn't exist)
            var problemId = await problemLookupService.GetRequiredProblemIdBySlugAsync(slug);

            // Toggle mark
            await userProblemService.ToggleMarkAsync(userId, problemId);

            // No reason to return anything?
            return Results.NoContent();
        })
        .RequireAuthorization()
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);
    }
}

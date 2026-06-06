using System.Globalization;
using MathComps.Domain.ApiDtos.Comments;
using MathComps.Domain.ApiDtos.Helpers;
using MathComps.Domain.ApiDtos.ProblemQuery;
using MathComps.Domain.ApiDtos.SearchBar;
using MathComps.Domain.ApiDtos.UserLists;
using MathComps.Infrastructure.Services;
using MathComps.Api.Constants;
using MathComps.Shared;

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
        app.MapPost("/problems/filter", async (FilterQuery query, HttpContext context, IUserManager userManager, IProblemFilterService problemService, IUserListService userListService) =>
        {
            // Get user ID (optional)
            var userId = await GetUserIdAsync(context, userManager);

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
            var language = GetRequestLanguage();

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
            var language = GetRequestLanguage();

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

            // Detect language from Accept-Language header
            var language = GetRequestLanguage();

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

        // The endpoint for toggling a mark on a problem
        app.MapPost("/problems/{slug}/mark", async (
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

            // Toggle mark
            await userProblemService.ToggleMarkAsync(userId.Value, problemId.Value);

            // No reason to return anything?
            return Results.NoContent();
        })
        .RequireAuthorization()
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        #region Comment Endpoints

        // Get threaded comments for a target (handout, problem, news)
        app.MapGet("/comments", async (
            CommentTargetType targetType,
            string targetId,
            IUserManager userManager,
            HttpContext context,
            ICommentService commentService) =>
        {
            // Get user ID... might be null
            var userId = await GetUserIdAsync(context, userManager);

            // Get the comments
            var comments = await commentService.GetCommentsAsync(
                new CommentTarget(targetType, targetId),
                userId
            );

            // Return the comments
            return Results.Ok(comments);
        })
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Get comment counts for multiple targets in bulk (useful for news feed or handout list)
        app.MapPost("/comments/counts", async (
            GetCommentCountsRequest request,
            ICommentService commentService) =>
        {
            // Get the slug->count mapping
            var counts = await commentService.GetCommentCountsAsync(request.TargetType, request.TargetIds);

            // Return the mapping
            return Results.Ok(counts);
        })
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Create a new comment or reply
        app.MapPost("/comments", async (
            CreateCommentRequest request,
            HttpContext context,
            IUserManager userManager,
            ICommentService commentService) =>
        {
            // Get user ID
            var userId = await GetUserIdAsync(context, userManager);

            // We must have a user
            if (userId == null)
                return Results.Unauthorized();

            // Create comment
            var comment = await commentService.CreateCommentAsync(
                request.Target,
                userId.Value,
                request.Content,
                request.ParentCommentId);

            // Return the created comment
            return Results.Created($"/comments/{comment.Id}", comment);
        })
        .RequireAuthorization()
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Update (edit) a comment
        app.MapPut("/comments/{id:guid}", async (
            Guid id,
            UpdateCommentRequest request,
            HttpContext context,
            IUserManager userManager,
            ICommentService commentService) =>
        {
            // Get user ID
            var userId = await GetUserIdAsync(context, userManager);

            // We must have a user
            if (userId == null)
                return Results.Unauthorized();

            // Update comment
            var updatedCommentData = await commentService.UpdateCommentAsync(
                request.Target,
                id,
                userId.Value,
                request.Content);

            // Return the updated comment
            return Results.Ok(updatedCommentData);
        })
        .RequireAuthorization()
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Soft-delete a comment
        app.MapDelete("/comments/{id:guid}", async (
            Guid id,
            HttpContext context,
            IUserManager userManager,
            ICommentService commentService) =>
        {
            // Get user ID
            var userId = await GetUserIdAsync(context, userManager);

            // We must have a user
            if (userId == null)
                return Results.Unauthorized();

            // Perform delete
            await commentService.DeleteCommentAsync(id, userId.Value);

            // No reason to return anything
            return Results.NoContent();
        })
        .RequireAuthorization()
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Toggle like on a comment
        app.MapPost("/comments/{id:guid}/like", async (
            Guid id,
            HttpContext context,
            IUserManager userManager,
            ICommentService commentService) =>
        {
            // Get user ID
            var userId = await GetUserIdAsync(context, userManager);

            // We must have a user
            if (userId == null)
                return Results.Unauthorized();

            // Perform toggle
            await commentService.ToggleLikeAsync(id, userId.Value);

            // No reason to return anything
            return Results.NoContent();
        })
        .RequireAuthorization()
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        #endregion Comment Endpoints

        #region User List Endpoints

        // Get all lists for the authenticated user
        app.MapGet("/users/me/lists", async (
            HttpContext context,
            IUserManager userManager,
            IUserListService userListService) =>
        {
            // Get user ID
            var userId = await GetUserIdAsync(context, userManager);

            // We must have a user
            if (userId == null)
                return Results.Unauthorized();

            // Get the user's lists
            var lists = await userListService.GetListsAsync(userId.Value);

            // Return the lists
            return Results.Ok(lists);
        })
        .RequireAuthorization()
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Create a new user list
        app.MapPost("/users/me/lists", async (
            CreateListRequest request,
            HttpContext context,
            IUserManager userManager,
            IUserListService userListService) =>
        {
            // Get user ID
            var userId = await GetUserIdAsync(context, userManager);

            // We must have a user
            if (userId == null)
                return Results.Unauthorized();

            // Create the list
            var list = await userListService.CreateListAsync(userId.Value, request.Name);

            // Return the created list
            return Results.Created($"/users/me/lists/{list.ContentId}", list);
        })
        .RequireAuthorization()
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Rename an existing user list
        app.MapPatch("/users/me/lists/{contentId}", async (
            string contentId,
            UpdateListRequest request,
            HttpContext context,
            IUserManager userManager,
            IUserListService userListService) =>
        {
            // Get user ID
            var userId = await GetUserIdAsync(context, userManager);

            // We must have a user
            if (userId == null)
                return Results.Unauthorized();

            // Update the list
            var list = await userListService.UpdateListAsync(userId.Value, contentId, request.Name);

            // Return the updated list
            return Results.Ok(list);
        })
        .RequireAuthorization()
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Delete a user list
        app.MapDelete("/users/me/lists/{contentId}", async (
            string contentId,
            HttpContext context,
            IUserManager userManager,
            IUserListService userListService) =>
        {
            // Get user ID
            var userId = await GetUserIdAsync(context, userManager);

            // We must have a user
            if (userId == null)
                return Results.Unauthorized();

            // Delete the list
            await userListService.DeleteListAsync(userId.Value, contentId);

            // No reason to return anything
            return Results.NoContent();
        })
        .RequireAuthorization()
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Add a problem to a user list
        app.MapPost("/users/me/lists/{contentId}/problems/{problemSlug}", async (
            string contentId,
            string problemSlug,
            HttpContext context,
            IUserManager userManager,
            IUserListService userListService) =>
        {
            // Get user ID
            var userId = await GetUserIdAsync(context, userManager);

            // We must have a user
            if (userId == null)
                return Results.Unauthorized();

            // Add the problem to the list
            await userListService.AddProblemAsync(userId.Value, contentId, problemSlug);

            // No reason to return anything
            return Results.NoContent();
        })
        .RequireAuthorization()
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Remove a problem from a user list
        app.MapDelete("/users/me/lists/{contentId}/problems/{problemSlug}", async (
            string contentId,
            string problemSlug,
            HttpContext context,
            IUserManager userManager,
            IUserListService userListService) =>
        {
            // Get user ID
            var userId = await GetUserIdAsync(context, userManager);

            // We must have a user
            if (userId == null)
                return Results.Unauthorized();

            // Remove the problem from the list
            await userListService.RemoveProblemAsync(userId.Value, contentId, problemSlug);

            // No reason to return anything
            return Results.NoContent();
        })
        .RequireAuthorization()
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Reorder all lists for the authenticated user
        app.MapPut("/users/me/lists/order", async (
            ReorderListsRequest request,
            HttpContext context,
            IUserManager userManager,
            IUserListService userListService) =>
        {
            // Get user ID
            var userId = await GetUserIdAsync(context, userManager);

            // We must have a user
            if (userId == null)
                return Results.Unauthorized();

            // Reorder the lists
            await userListService.ReorderListsAsync(userId.Value, request.ContentIds);

            // No reason to return anything
            return Results.NoContent();
        })
        .RequireAuthorization()
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Enable public sharing for a list
        app.MapPost("/users/me/lists/{contentId}/share", async (
            string contentId,
            HttpContext context,
            IUserManager userManager,
            IUserListService userListService) =>
        {
            // Get user ID
            var userId = await GetUserIdAsync(context, userManager);

            // We must have a user
            if (userId == null)
                return Results.Unauthorized();

            // Enable sharing
            var list = await userListService.SetSharingAsync(userId.Value, contentId, enabled: true);

            // Return the updated list
            return Results.Ok(list);
        })
        .RequireAuthorization()
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Disable public sharing for a list
        app.MapDelete("/users/me/lists/{contentId}/share", async (
            string contentId,
            HttpContext context,
            IUserManager userManager,
            IUserListService userListService) =>
        {
            // Get user ID
            var userId = await GetUserIdAsync(context, userManager);

            // We must have a user
            if (userId == null)
                return Results.Unauthorized();

            // Disable sharing
            await userListService.SetSharingAsync(userId.Value, contentId, enabled: false);

            // No reason to return anything
            return Results.NoContent();
        })
        .RequireAuthorization()
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        #endregion User List Endpoints

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

    /// <summary>
    /// Gets the request language from the current thread culture.
    /// The RequestLocalization middleware sets CurrentCulture based on Accept-Language header.
    /// </summary>
    /// <returns>The Language enum value for the current request.</returns>
    /// <exception cref="InvalidOperationException">Thrown when culture cannot be parsed to Language enum.</exception>
    private static Language GetRequestLanguage()
        => Enum.TryParse<Language>(
                CultureInfo.CurrentCulture.TwoLetterISOLanguageName,
                ignoreCase: true,
                out var language)
            ? language
            : throw new InvalidOperationException($"Unsupported culture '{CultureInfo.CurrentCulture.TwoLetterISOLanguageName}'");
}

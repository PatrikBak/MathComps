using MathComps.Api.Constants;
using MathComps.Domain.Contracts.UserLists;
using MathComps.Infrastructure.Services.Users;

namespace MathComps.Api.Endpoints;

/// <summary>
/// Maps the authenticated user's problem-list endpoints — listing, create/rename/delete, adding and removing
/// problems, reordering, and toggling public sharing.
/// </summary>
public static class UserListEndpoints
{
    /// <summary>
    /// Maps the <c>/users/me/lists</c> endpoints onto the route builder.
    /// </summary>
    /// <param name="app">The route builder to register the endpoints on.</param>
    public static void MapUserListEndpoints(this IEndpointRouteBuilder app)
    {
        // Get all lists for the authenticated user
        app.MapGet("/users/me/lists", async (
            HttpContext context,
            IUserManager userManager,
            IUserListService userListService) =>
        {
            // Get user ID
            var userId = await EndpointHelpers.GetUserIdAsync(context, userManager);

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
            var userId = await EndpointHelpers.GetUserIdAsync(context, userManager);

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
            var userId = await EndpointHelpers.GetUserIdAsync(context, userManager);

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
            var userId = await EndpointHelpers.GetUserIdAsync(context, userManager);

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
            var userId = await EndpointHelpers.GetUserIdAsync(context, userManager);

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
            var userId = await EndpointHelpers.GetUserIdAsync(context, userManager);

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
            var userId = await EndpointHelpers.GetUserIdAsync(context, userManager);

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
            var userId = await EndpointHelpers.GetUserIdAsync(context, userManager);

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
            var userId = await EndpointHelpers.GetUserIdAsync(context, userManager);

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
    }
}

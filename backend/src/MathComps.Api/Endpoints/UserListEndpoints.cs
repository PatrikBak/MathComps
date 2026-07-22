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
    /// Base path the user-list routes derive from.
    /// </summary>
    private const string ListsPath = "/users/me/lists";

    /// <summary>
    /// Maps the <c>/users/me/lists</c> endpoints onto the route builder.
    /// </summary>
    /// <param name="app">The route builder to register the endpoints on.</param>
    public static void MapUserListEndpoints(this IEndpointRouteBuilder app)
    {
        // Get all lists for the authenticated user
        app.MapGet(ListsPath, async (
            HttpContext context,
            IUserManager userManager,
            IUserListService userListService) =>
        {
            // Resolve the caller, faulting when the request has no user behind it
            var userId = await userManager.RequireUserIdAsync(context);

            // Get the user's lists
            var lists = await userListService.GetListsAsync(userId);

            // Return the lists
            return Results.Ok(lists);
        })
        .RequireAuthorization()
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Create a new user list
        app.MapPost(ListsPath, async (
            CreateListRequest request,
            HttpContext context,
            IUserManager userManager,
            IUserListService userListService) =>
        {
            // Resolve the caller, faulting when the request has no user behind it
            var userId = await userManager.RequireUserIdAsync(context);

            // Create the list
            var list = await userListService.CreateListAsync(userId, request.Name);

            // Return the created list
            return Results.Created($"{ListsPath}/{list.ContentId}", list);
        })
        .RequireAuthorization()
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Rename an existing user list
        app.MapPatch($"{ListsPath}/{{contentId}}", async (
            string contentId,
            UpdateListRequest request,
            HttpContext context,
            IUserManager userManager,
            IUserListService userListService) =>
        {
            // Resolve the caller, faulting when the request has no user behind it
            var userId = await userManager.RequireUserIdAsync(context);

            // Update the list
            var list = await userListService.UpdateListAsync(userId, contentId, request.Name);

            // Return the updated list
            return Results.Ok(list);
        })
        .RequireAuthorization()
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Delete a user list
        app.MapDelete($"{ListsPath}/{{contentId}}", async (
            string contentId,
            HttpContext context,
            IUserManager userManager,
            IUserListService userListService) =>
        {
            // Resolve the caller, faulting when the request has no user behind it
            var userId = await userManager.RequireUserIdAsync(context);

            // Delete the list
            await userListService.DeleteListAsync(userId, contentId);

            // No reason to return anything
            return Results.NoContent();
        })
        .RequireAuthorization()
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Add a problem to a user list
        app.MapPost($"{ListsPath}/{{contentId}}/problems/{{problemSlug}}", async (
            string contentId,
            string problemSlug,
            HttpContext context,
            IUserManager userManager,
            IUserListService userListService) =>
        {
            // Resolve the caller, faulting when the request has no user behind it
            var userId = await userManager.RequireUserIdAsync(context);

            // Add the problem to the list
            await userListService.AddProblemAsync(userId, contentId, problemSlug);

            // No reason to return anything
            return Results.NoContent();
        })
        .RequireAuthorization()
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Remove a problem from a user list
        app.MapDelete($"{ListsPath}/{{contentId}}/problems/{{problemSlug}}", async (
            string contentId,
            string problemSlug,
            HttpContext context,
            IUserManager userManager,
            IUserListService userListService) =>
        {
            // Resolve the caller, faulting when the request has no user behind it
            var userId = await userManager.RequireUserIdAsync(context);

            // Remove the problem from the list
            await userListService.RemoveProblemAsync(userId, contentId, problemSlug);

            // No reason to return anything
            return Results.NoContent();
        })
        .RequireAuthorization()
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Reorder all lists for the authenticated user
        app.MapPut($"{ListsPath}/order", async (
            ReorderListsRequest request,
            HttpContext context,
            IUserManager userManager,
            IUserListService userListService) =>
        {
            // Resolve the caller, faulting when the request has no user behind it
            var userId = await userManager.RequireUserIdAsync(context);

            // Reorder the lists
            await userListService.ReorderListsAsync(userId, request.ContentIds);

            // No reason to return anything
            return Results.NoContent();
        })
        .RequireAuthorization()
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Enable public sharing for a list
        app.MapPost($"{ListsPath}/{{contentId}}/share", async (
            string contentId,
            HttpContext context,
            IUserManager userManager,
            IUserListService userListService) =>
        {
            // Resolve the caller, faulting when the request has no user behind it
            var userId = await userManager.RequireUserIdAsync(context);

            // Enable sharing
            var list = await userListService.SetSharingAsync(userId, contentId, enabled: true);

            // Return the updated list
            return Results.Ok(list);
        })
        .RequireAuthorization()
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Disable public sharing for a list
        app.MapDelete($"{ListsPath}/{{contentId}}/share", async (
            string contentId,
            HttpContext context,
            IUserManager userManager,
            IUserListService userListService) =>
        {
            // Resolve the caller, faulting when the request has no user behind it
            var userId = await userManager.RequireUserIdAsync(context);

            // Disable sharing
            await userListService.SetSharingAsync(userId, contentId, enabled: false);

            // No reason to return anything
            return Results.NoContent();
        })
        .RequireAuthorization()
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);
    }
}

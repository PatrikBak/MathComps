using MathComps.Api.Constants;
using MathComps.Domain.Contracts.Comments;
using MathComps.Infrastructure.Services.Comments;
using MathComps.Infrastructure.Services.Users;

namespace MathComps.Api.Endpoints;

/// <summary>
/// Maps the endpoints for reading and writing comment threads.
/// </summary>
public static class CommentEndpoints
{
    /// <summary>
    /// Base path the comment routes derive from.
    /// </summary>
    private const string CommentsPath = "/comments";

    /// <summary>
    /// Maps the <c>/comments</c> endpoints onto the route builder.
    /// </summary>
    /// <param name="app">The route builder to register the endpoints on.</param>
    public static void MapCommentEndpoints(this IEndpointRouteBuilder app)
    {
        // Get a target's comment thread
        app.MapGet(CommentsPath, async (
            CommentTargetType targetType,
            string targetId,
            IUserManager userManager,
            HttpContext context,
            ICommentService commentService) =>
        {
            // Who is asking... might be nobody
            var viewer = await GetViewerAsync(userManager, context);

            // Get the comments
            var comments = await commentService.GetCommentsAsync(
                new CommentTarget(targetType, targetId),
                viewer
            );

            // Return the comments
            return Results.Ok(comments);
        })
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Get comment counts for many targets of one type
        app.MapPost($"{CommentsPath}/counts", async (
            GetCommentCountsRequest request,
            IUserManager userManager,
            HttpContext context,
            ICommentService commentService) =>
        {
            // Who is asking... might be nobody
            var viewer = await GetViewerAsync(userManager, context);

            // Each target's active comment count by its id
            var counts = await commentService.GetCommentCountsAsync(request.TargetType, request.TargetIds, viewer);

            // Return the mapping
            return Results.Ok(counts);
        })
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Create a new comment or reply
        app.MapPost(CommentsPath, async (
            CreateCommentRequest request,
            HttpContext context,
            IUserManager userManager,
            ICommentService commentService) =>
        {
            // Resolve the caller, faulting when the request has no user behind it
            var viewer = await RequireViewerAsync(userManager, context);

            // Create comment
            var comment = await commentService.CreateCommentAsync(
                request.Target,
                viewer,
                request.Content,
                request.ParentCommentId);

            // Return the created comment
            return Results.Created($"{CommentsPath}/{comment.Id}", comment);
        })
        .RequireAuthorization()
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Update (edit) a comment
        app.MapPut($"{CommentsPath}/{{id:guid}}", async (
            Guid id,
            UpdateCommentRequest request,
            HttpContext context,
            IUserManager userManager,
            ICommentService commentService) =>
        {
            // Resolve the caller, faulting when the request has no user behind it
            var viewer = await RequireViewerAsync(userManager, context);

            // Update comment
            var updatedCommentData = await commentService.UpdateCommentAsync(
                id,
                viewer,
                request.Content);

            // Return the new version's id and edit time
            return Results.Ok(updatedCommentData);
        })
        .RequireAuthorization()
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Delete a comment
        app.MapDelete($"{CommentsPath}/{{id:guid}}", async (
            Guid id,
            HttpContext context,
            IUserManager userManager,
            ICommentService commentService) =>
        {
            // Resolve the caller, faulting when the request has no user behind it
            var viewer = await RequireViewerAsync(userManager, context);

            // Perform delete
            await commentService.DeleteCommentAsync(id, viewer);

            // No reason to return anything
            return Results.NoContent();
        })
        .RequireAuthorization()
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Toggle like on a comment
        app.MapPost($"{CommentsPath}/{{id:guid}}/like", async (
            Guid id,
            HttpContext context,
            IUserManager userManager,
            ICommentService commentService) =>
        {
            // Resolve the caller, faulting when the request has no user behind it
            var viewer = await RequireViewerAsync(userManager, context);

            // Perform toggle
            await commentService.ToggleLikeAsync(id, viewer);

            // No reason to return anything
            return Results.NoContent();
        })
        .RequireAuthorization()
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);
    }

    /// <summary>
    /// Resolves who is asking, for a request anybody may make.
    /// </summary>
    /// <param name="userManager">Resolves an external provider id to the internal user id.</param>
    /// <param name="context">The HTTP context carrying the caller's claims.</param>
    /// <returns>The viewer, or null when the request carries no resolvable user.</returns>
    private static async Task<CommentViewer?> GetViewerAsync(IUserManager userManager, HttpContext context) =>
        // The user with their role, where there is one
        await userManager.GetUserIdAsync(context) is { } userId
            ? new CommentViewer(userId, context.User.IsInRole(ClerkClaims.AdminRole))
            : null;

    /// <summary>
    /// Resolves who is asking, for a request only a user may make, throwing
    /// <see cref="UserNotResolvedException"/> when the caller can't be resolved to one.
    /// </summary>
    /// <param name="userManager">Resolves an external provider id to the internal user id.</param>
    /// <param name="context">The HTTP context carrying the caller's claims.</param>
    /// <returns>The viewer.</returns>
    private static async Task<CommentViewer> RequireViewerAsync(IUserManager userManager, HttpContext context) =>
        // The user with their role, who must be there
        await GetViewerAsync(userManager, context) ?? throw new UserNotResolvedException();
}

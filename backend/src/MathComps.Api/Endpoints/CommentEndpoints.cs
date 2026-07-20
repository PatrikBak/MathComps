using MathComps.Api.Constants;
using MathComps.Domain.Contracts.Comments;
using MathComps.Infrastructure.Services.Comments;
using MathComps.Infrastructure.Services.Users;

namespace MathComps.Api.Endpoints;

/// <summary>
/// Maps the comment endpoints — reading threaded comments, bulk counts, and the authenticated
/// create/edit/delete/like operations on a comment.
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
        // Get threaded comments for a target (handout, problem, news)
        app.MapGet(CommentsPath, async (
            CommentTargetType targetType,
            string targetId,
            IUserManager userManager,
            HttpContext context,
            ICommentService commentService) =>
        {
            // Get user ID... might be null
            var userId = await userManager.GetUserIdAsync(context);

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
        app.MapPost($"{CommentsPath}/counts", async (
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
        app.MapPost(CommentsPath, async (
            CreateCommentRequest request,
            HttpContext context,
            IUserManager userManager,
            ICommentService commentService) =>
        {
            // Get user ID
            var userId = await userManager.GetUserIdAsync(context);

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
            // Get user ID
            var userId = await userManager.GetUserIdAsync(context);

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
        app.MapDelete($"{CommentsPath}/{{id:guid}}", async (
            Guid id,
            HttpContext context,
            IUserManager userManager,
            ICommentService commentService) =>
        {
            // Get user ID
            var userId = await userManager.GetUserIdAsync(context);

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
        app.MapPost($"{CommentsPath}/{{id:guid}}/like", async (
            Guid id,
            HttpContext context,
            IUserManager userManager,
            ICommentService commentService) =>
        {
            // Get user ID
            var userId = await userManager.GetUserIdAsync(context);

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
    }
}

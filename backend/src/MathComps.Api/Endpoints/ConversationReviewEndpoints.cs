using MathComps.Api.Authorization;
using MathComps.Api.Constants;
using MathComps.Infrastructure.Services.ConversationReview;
using MathComps.Infrastructure.Services.Users;

namespace MathComps.Api.Endpoints;

/// <summary>
/// Maps the endpoints for reading one defense conversation back and recording how far a reviewer has read it, each
/// open to whoever <see cref="ConversationReviewerExtensions.RequireConversationReviewer"/> lets reach the
/// conversation.
/// </summary>
public static class ConversationReviewEndpoints
{
    /// <summary>
    /// The base path the review endpoints hang off.
    /// </summary>
    private const string ReviewPath = "/admin/defense";

    /// <summary>
    /// Maps the endpoints on one conversation onto the route builder.
    /// </summary>
    /// <param name="app">The route builder to register the endpoints on.</param>
    public static void MapConversationReviewEndpoints(this IEndpointRouteBuilder app)
    {
        // Read one conversation in full
        app.MapGet($"{ReviewPath}/sessions/{{id:guid}}", async (
            Guid id,
            HttpContext context,
            IUserManager userManager,
            IConversationReviewService reviewService,
            CancellationToken cancellationToken) =>
        {
            // The reviewer asking, whose own stamp comes back with it
            var reviewerId = await userManager.RequireUserIdAsync(context);

            // The whole conversation, along with the read stamp as it stood before this read
            var detail = await reviewService.GetDetailAsync(
                reviewerId, id, EndpointHelpers.GetRequestLanguage(), cancellationToken);

            // Return it
            return Results.Ok(detail);
        })
        .RequireConversationReviewer()
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Record that a conversation has been read. Kept off reading it in full on purpose: that response carries
        // the previous stamp, which is what marks where the last pass stopped, and stamping there would erase it.
        app.MapPut($"{ReviewPath}/sessions/{{id:guid}}/review", async (
            Guid id,
            HttpContext context,
            IUserManager userManager,
            IConversationReviewService reviewService,
            CancellationToken cancellationToken) =>
        {
            // The reviewer who read it
            var reviewerId = await userManager.RequireUserIdAsync(context);

            // Stamp it as read now
            await reviewService.MarkReadAsync(reviewerId, id, cancellationToken);

            // Nothing to return
            return Results.NoContent();
        })
        .RequireConversationReviewer()
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Move where a reviewer picks the conversation up again, leaving the named turn and everything after it to
        // be read a second time
        app.MapPut($"{ReviewPath}/sessions/{{id:guid}}/review/from/{{turnId:guid}}", async (
            Guid id,
            Guid turnId,
            HttpContext context,
            IUserManager userManager,
            IConversationReviewService reviewService,
            CancellationToken cancellationToken) =>
        {
            // The reviewer whose reading is being moved
            var reviewerId = await userManager.RequireUserIdAsync(context);

            // Move it back to just before that turn
            await reviewService.MarkUnreadFromAsync(reviewerId, id, turnId, cancellationToken);

            // Nothing to return
            return Results.NoContent();
        })
        .RequireConversationReviewer()
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Put a conversation back to unread
        app.MapDelete($"{ReviewPath}/sessions/{{id:guid}}/review", async (
            Guid id,
            HttpContext context,
            IUserManager userManager,
            IConversationReviewService reviewService,
            CancellationToken cancellationToken) =>
        {
            // The reviewer taking it back
            var reviewerId = await userManager.RequireUserIdAsync(context);

            // Drop the stamp
            await reviewService.MarkUnreadAsync(reviewerId, id, cancellationToken);

            // Nothing to return
            return Results.NoContent();
        })
        .RequireConversationReviewer()
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);
    }
}

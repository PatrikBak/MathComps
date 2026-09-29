using MathComps.Api.Constants;
using MathComps.Domain.Contracts.Admin;
using MathComps.Domain.Contracts.Defense;
using MathComps.Infrastructure.Services.Admin;
using MathComps.Infrastructure.Services.Users;

namespace MathComps.Api.Endpoints;

/// <summary>
/// Maps the endpoints for reading every student's defense conversations back and recording which of them a
/// reviewer has read, gated by the <see cref="AuthorizationPolicies.Admin"/> policy. They read across all
/// users, which is exactly what the student-facing <c>/defense</c> endpoints refuse to do.
/// </summary>
public static class AdminDefenseReviewEndpoints
{
    /// <summary>
    /// The base path the review endpoints hang off.
    /// </summary>
    private const string ReviewPath = "/admin/defense";

    /// <summary>
    /// The most conversations one bulk mark may name. Set above any queue a reviewer scrolls in one sitting, so
    /// that the ceiling only ever catches a body nothing on this surface built.
    /// </summary>
    private const int MaxBulkMarkSessions = 1000;

    /// <summary>
    /// Maps the <c>/admin/defense</c> endpoints onto the route builder.
    /// </summary>
    /// <param name="app">The route builder to register the endpoints on.</param>
    public static void MapAdminDefenseReviewEndpoints(this IEndpointRouteBuilder app)
    {
        // Read a page of the queue. The filters go in a body rather than a query string, there being too many
        // of them to spell out in a URL.
        app.MapPost($"{ReviewPath}/sessions/filter", async (
            AdminDefenseQueueRequest request,
            HttpContext context,
            IUserManager userManager,
            IAdminDefenseReviewService reviewService,
            CancellationToken cancellationToken) =>
        {
            // A body carrying no filters at all names no queue to read. The wire can express it and the
            // service's own contract can't, so it is refused here.
            if (request.Filter is not { } filter)
                throw new BadHttpRequestException("A queue request must carry its filters.");

            // The reviewer asking, whose own read marks decide what the queue counts as unread
            var reviewerId = await userManager.RequireUserIdAsync(context);

            // The page of conversations, each problem named in the language the request asks for
            var queue = await reviewService.GetQueueAsync(
                reviewerId,
                filter,
                request.PageNumber,
                EndpointHelpers.GetRequestLanguage(),
                cancellationToken);

            // Return it
            return Results.Ok(queue);
        })
        .RequireAuthorization(AuthorizationPolicies.Admin)
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Read what the filters can be set to
        app.MapGet($"{ReviewPath}/filters", async (
            IAdminDefenseReviewService reviewService,
            CancellationToken cancellationToken) =>
        {
            // Every student, problem and set of examiner settings a conversation exists under
            var options = await reviewService.GetFilterOptionsAsync(
                EndpointHelpers.GetRequestLanguage(), cancellationToken);

            // Return them
            return Results.Ok(options);
        })
        .RequireAuthorization(AuthorizationPolicies.Admin)
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Read one conversation in full
        app.MapGet($"{ReviewPath}/sessions/{{id:guid}}", async (
            Guid id,
            HttpContext context,
            IUserManager userManager,
            IAdminDefenseReviewService reviewService,
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
        .RequireAuthorization(AuthorizationPolicies.Admin)
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // List one student's conversations against one handout environment
        app.MapGet($"{ReviewPath}/students/{{userId:guid}}/sessions", async (
            Guid userId,
            string handoutContentId,
            string environmentId,
            IAdminDefenseReviewService reviewService,
            CancellationToken cancellationToken) =>
        {
            // The environment the conversations are held against
            var target = new HandoutEnvironmentTarget(handoutContentId, environmentId);

            // The student's conversations against it
            var conversations = await reviewService.GetStudentConversationsAsync(userId, target, cancellationToken);

            // Return them
            return Results.Ok(conversations);
        })
        .RequireAuthorization(AuthorizationPolicies.Admin)
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // List one student's conversations against one archive problem, with how they are graded on it
        app.MapGet($"{ReviewPath}/students/{{userId:guid}}/sessions/problems/{{problemId:guid}}", async (
            Guid userId,
            Guid problemId,
            IAdminDefenseReviewService reviewService,
            CancellationToken cancellationToken) =>
        {
            // The problem the conversations are held against
            var target = new ProblemTarget(problemId);

            // The student's conversations against it, with their grading
            var conversations = await reviewService.GetStudentConversationsAsync(userId, target, cancellationToken);

            // Return them
            return Results.Ok(conversations);
        })
        .RequireAuthorization(AuthorizationPolicies.Admin)
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Record that a conversation has been read. Kept off reading it in full on purpose: that response carries
        // the previous stamp, which is what marks where the last pass stopped, and stamping there would erase it.
        app.MapPut($"{ReviewPath}/sessions/{{id:guid}}/review", async (
            Guid id,
            HttpContext context,
            IUserManager userManager,
            IAdminDefenseReviewService reviewService,
            CancellationToken cancellationToken) =>
        {
            // The reviewer who read it
            var reviewerId = await userManager.RequireUserIdAsync(context);

            // Stamp it as read now
            await reviewService.MarkReadAsync(reviewerId, id, cancellationToken);

            // Nothing to return
            return Results.NoContent();
        })
        .RequireAuthorization(AuthorizationPolicies.Admin)
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Mark a whole set read at once. One request rather than one per conversation, since these endpoints are
        // rate limited per caller and a scrolled queue can hold more conversations than a limiter window does.
        app.MapPut($"{ReviewPath}/sessions/review", async (
            MarkDefenseReviewsRequest request,
            HttpContext context,
            IUserManager userManager,
            IAdminDefenseReviewService reviewService,
            CancellationToken cancellationToken) =>
        {
            // A body naming no conversations names no mark to make
            if (request.SessionIds is not { Count: > 0 } sessionIds)
                throw new BadHttpRequestException("A bulk mark must name the conversations.");

            // Bounded so one body can't ask for a write the size of the table
            if (sessionIds.Count > MaxBulkMarkSessions)
                throw new BadHttpRequestException(
                    $"A bulk mark may name at most {MaxBulkMarkSessions} conversations.");

            // The reviewer whose marks these are
            var reviewerId = await userManager.RequireUserIdAsync(context);

            // Mark the lot of them read
            await reviewService.MarkManyReadAsync(reviewerId, sessionIds, cancellationToken);

            // Nothing to return
            return Results.NoContent();
        })
        .RequireAuthorization(AuthorizationPolicies.Admin)
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Move where a reviewer picks the conversation up again, leaving the named turn and everything after it to
        // be read a second time
        app.MapPut($"{ReviewPath}/sessions/{{id:guid}}/review/from/{{turnId:guid}}", async (
            Guid id,
            Guid turnId,
            HttpContext context,
            IUserManager userManager,
            IAdminDefenseReviewService reviewService,
            CancellationToken cancellationToken) =>
        {
            // The reviewer whose reading is being moved
            var reviewerId = await userManager.RequireUserIdAsync(context);

            // Move it back to just before that turn
            await reviewService.MarkUnreadFromAsync(reviewerId, id, turnId, cancellationToken);

            // Nothing to return
            return Results.NoContent();
        })
        .RequireAuthorization(AuthorizationPolicies.Admin)
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Put a conversation back to unread
        app.MapDelete($"{ReviewPath}/sessions/{{id:guid}}/review", async (
            Guid id,
            HttpContext context,
            IUserManager userManager,
            IAdminDefenseReviewService reviewService,
            CancellationToken cancellationToken) =>
        {
            // The reviewer taking it back
            var reviewerId = await userManager.RequireUserIdAsync(context);

            // Drop the stamp
            await reviewService.MarkUnreadAsync(reviewerId, id, cancellationToken);

            // Nothing to return
            return Results.NoContent();
        })
        .RequireAuthorization(AuthorizationPolicies.Admin)
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);
    }
}

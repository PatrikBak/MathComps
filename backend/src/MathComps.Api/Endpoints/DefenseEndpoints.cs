using MathComps.Api.Constants;
using MathComps.Domain.Contracts.Defense;
using MathComps.Infrastructure.Services.Defense;
using MathComps.Infrastructure.Services.Users;

namespace MathComps.Api.Endpoints;

/// <summary>
/// Maps the defense endpoints: listing a user's defense conversations, for one problem or across every problem,
/// starting one, continuing it with the next turn, rewinding one to an earlier point, recording or taking back
/// what the student thought of it, and deleting one. Admin-gated, though built per-user; the turn routes are
/// tightly rate-limited because each turn is several LLM calls.
/// </summary>
public static class DefenseEndpoints
{
    /// <summary>
    /// Base path for the defense session routes.
    /// </summary>
    private const string SessionsPath = "/defense/sessions";

    /// <summary>
    /// Maps the <c>/defense</c> endpoints onto the route builder.
    /// </summary>
    /// <param name="app">The route builder to register the endpoints on.</param>
    public static void MapDefenseEndpoints(this IEndpointRouteBuilder app)
    {
        // List the user's sessions against one handout environment
        app.MapGet(SessionsPath, async (
            string handoutContentId,
            string environmentId,
            HttpContext context,
            IUserManager userManager,
            IDefenseSessionService defenseService) =>
        {
            // Resolve the calling user
            var userId = await userManager.RequireUserIdAsync(context);

            // The environment the sessions are held against
            var target = new HandoutEnvironmentTarget(handoutContentId, environmentId);

            // Fetch the user's sessions against it
            var sessions = await defenseService.ListAsync(userId, target, context.RequestAborted);

            // Return them
            return Results.Ok(sessions);
        })
        .RequireAuthorization(AuthorizationPolicies.Admin)
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // List all of the user's sessions across every problem
        app.MapGet($"{SessionsPath}/mine", async (
            HttpContext context,
            IUserManager userManager,
            IDefenseSessionService defenseService) =>
        {
            // Resolve the calling user
            var userId = await userManager.RequireUserIdAsync(context);

            // Fetch every session the user holds, newest first
            var sessions = await defenseService.ListAllAsync(userId, context.RequestAborted);

            // Return them
            return Results.Ok(sessions);
        })
        .RequireAuthorization(AuthorizationPolicies.Admin)
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Start a new session with the student's first message
        app.MapPost(SessionsPath, async (
            StartDefenseRequest request,
            HttpContext context,
            IUserManager userManager,
            IDefenseSessionService defenseService) =>
        {
            // Resolve the calling user
            var userId = await userManager.RequireUserIdAsync(context);

            // Map the request onto the service's own input shape
            var start = new DefenseSessionStart(
                request.Target, request.Statement, request.Reference, request.Opener, request.Content,
                request.Hints);

            // Run the opening turn
            var session = await defenseService.StartAsync(userId, start, context.RequestAborted);

            // Return the created session at its location
            return Results.Created($"{SessionsPath}/{session.Id}", session);
        })
        .RequireAuthorization(AuthorizationPolicies.Admin)
        .RequireRateLimiting(RateLimiterPolicies.DefenseTurnRateLimit);

        // Continue a session with the student's next message
        app.MapPost($"{SessionsPath}/{{id:guid}}/turns", async (
            Guid id,
            ContinueDefenseRequest request,
            HttpContext context,
            IUserManager userManager,
            IDefenseSessionService defenseService) =>
        {
            // Resolve the calling user
            var userId = await userManager.RequireUserIdAsync(context);

            // Run the next turn
            var session = await defenseService.ContinueAsync(userId, id, request.Content, context.RequestAborted);

            // Return the updated session
            return Results.Ok(session);
        })
        .RequireAuthorization(AuthorizationPolicies.Admin)
        .RequireRateLimiting(RateLimiterPolicies.DefenseTurnRateLimit);

        // Rewind a session to an earlier point, dropping every turn after it
        app.MapPost($"{SessionsPath}/{{id:guid}}/rewind", async (
            Guid id,
            RewindDefenseRequest request,
            HttpContext context,
            IUserManager userManager,
            IDefenseSessionService defenseService) =>
        {
            // Resolve the calling user
            var userId = await userManager.RequireUserIdAsync(context);

            // A body naming no cut point asks for nothing, which is the client's fault rather than ours
            var keepThroughSequence = request.KeepThroughSequence ?? throw new DefenseRewindTargetException();

            // Truncate the conversation to the chosen point
            await defenseService.RewindAsync(userId, id, keepThroughSequence, context.RequestAborted);

            // Nothing to return; the client already knows the kept prefix
            return Results.NoContent();
        })
        .RequireAuthorization(AuthorizationPolicies.Admin)
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Record what the student holds against one examiner reply, replacing anything they said before
        app.MapPut($"{SessionsPath}/{{sessionId:guid}}/turns/{{turnId:guid}}/report", async (
            Guid sessionId,
            Guid turnId,
            ReportDefenseTurnRequest request,
            HttpContext context,
            IUserManager userManager,
            IDefenseFeedbackService feedbackService) =>
        {
            // Resolve the calling user
            var userId = await userManager.RequireUserIdAsync(context);

            // A body naming no fault holds nothing against the reply, which is the client's fault rather than ours
            var categories = request.Categories ?? throw new DefenseFeedbackValueException();

            // Record the report
            await feedbackService.ReportTurnAsync(
                userId, sessionId, turnId, categories, request.Comment, context.RequestAborted);

            // Nothing to return; the client already knows what it reported
            return Results.NoContent();
        })
        .RequireAuthorization(AuthorizationPolicies.Admin)
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Record what the student says about the conversation, replacing anything they said before
        app.MapPut($"{SessionsPath}/{{id:guid}}/feedback", async (
            Guid id,
            SubmitDefenseFeedbackRequest request,
            HttpContext context,
            IUserManager userManager,
            IDefenseFeedbackService feedbackService) =>
        {
            // Resolve the calling user
            var userId = await userManager.RequireUserIdAsync(context);

            // A body naming no outcome answers nothing, which is the client's fault rather than ours
            var outcome = request.Outcome ?? throw new DefenseFeedbackValueException();

            // Record the answer
            await feedbackService.SubmitFeedbackAsync(
                userId, id, outcome, request.Comment, context.RequestAborted);

            // Nothing to return; the client already knows what it answered
            return Results.NoContent();
        })
        .RequireAuthorization(AuthorizationPolicies.Admin)
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Take back what the student held against one examiner reply
        app.MapDelete($"{SessionsPath}/{{sessionId:guid}}/turns/{{turnId:guid}}/report", async (
            Guid sessionId,
            Guid turnId,
            HttpContext context,
            IUserManager userManager,
            IDefenseFeedbackService feedbackService) =>
        {
            // Resolve the calling user
            var userId = await userManager.RequireUserIdAsync(context);

            // Drop the report
            await feedbackService.WithdrawTurnReportAsync(
                userId, sessionId, turnId, context.RequestAborted);

            // Nothing to return; the reply now carries nothing
            return Results.NoContent();
        })
        .RequireAuthorization(AuthorizationPolicies.Admin)
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Take back what the student said the conversation came to
        app.MapDelete($"{SessionsPath}/{{id:guid}}/feedback", async (
            Guid id,
            HttpContext context,
            IUserManager userManager,
            IDefenseFeedbackService feedbackService) =>
        {
            // Resolve the calling user
            var userId = await userManager.RequireUserIdAsync(context);

            // Drop the answer
            await feedbackService.WithdrawFeedbackAsync(userId, id, context.RequestAborted);

            // Nothing to return; the conversation is unanswered again
            return Results.NoContent();
        })
        .RequireAuthorization(AuthorizationPolicies.Admin)
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Delete a session outright
        app.MapDelete($"{SessionsPath}/{{id:guid}}", async (
            Guid id,
            HttpContext context,
            IUserManager userManager,
            IDefenseSessionService defenseService) =>
        {
            // Resolve the calling user
            var userId = await userManager.RequireUserIdAsync(context);

            // Perform the delete
            await defenseService.DeleteAsync(userId, id, context.RequestAborted);

            // Nothing to return
            return Results.NoContent();
        })
        .RequireAuthorization(AuthorizationPolicies.Admin)
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);
    }
}

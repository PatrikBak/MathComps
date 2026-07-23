using MathComps.Api.Constants;
using MathComps.Domain.Contracts.Defense;
using MathComps.Infrastructure.Services.Defense;
using MathComps.Infrastructure.Services.Users;

namespace MathComps.Api.Endpoints;

/// <summary>
/// Maps the defense endpoints: listing a user's defense conversations for a problem, starting one, continuing it
/// with the next turn, rewinding one to an earlier point, and deleting one. Admin-gated, though built per-user;
/// the turn routes are tightly rate-limited because each turn is several LLM calls.
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
        // List the user's sessions for one problem
        app.MapGet(SessionsPath, async (
            string problemKey,
            HttpContext context,
            IUserManager userManager,
            IDefenseSessionService defenseService) =>
        {
            // Resolve the calling user
            var userId = await userManager.RequireUserIdAsync(context);

            // Fetch the user's sessions for the problem
            var sessions = await defenseService.ListAsync(userId, problemKey, context.RequestAborted);

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
                request.ProblemKey, request.Statement, request.Reference, request.Opener, request.Content,
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

            // Truncate the conversation to the chosen point
            await defenseService.RewindAsync(userId, id, request.KeepThroughSequence, context.RequestAborted);

            // Nothing to return; the client already knows the kept prefix
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

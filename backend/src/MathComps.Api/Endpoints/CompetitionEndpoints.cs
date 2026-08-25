using MathComps.Api.Constants;
using MathComps.Infrastructure.Services.Competitions;
using MathComps.Infrastructure.Services.Users;

namespace MathComps.Api.Endpoints;

/// <summary>
/// Maps the endpoints behind the competitions the site hosts itself: reading the groups, reading what an entry
/// needs of the caller, spending an entry (by sitting it or by giving it up for the problems), closing one early,
/// and reading the problems an entry opens.
/// </summary>
/// <remarks>
/// The problems route is the only place an embargoed problem is served, and it serves one only to a caller who
/// has spent an entry into its competition. Everywhere else in the site an embargoed round stays invisible.
/// </remarks>
public static class CompetitionEndpoints
{
    /// <summary>
    /// Base path for the hosted competition routes.
    /// </summary>
    private const string CompetitionsPath = "/competitions";

    /// <summary>
    /// Maps the <c>/competitions</c> endpoints onto the route builder.
    /// </summary>
    /// <param name="app">The route builder to register the endpoints on.</param>
    public static void MapCompetitionEndpoints(this IEndpointRouteBuilder app)
    {
        // Every group the caller can see, with whatever entry they hold in each competition
        app.MapGet(CompetitionsPath, async (
            HttpContext context,
            IUserManager userManager,
            IHostedCompetitionService competitionService) =>
        {
            // The caller, who may be nobody: a signed-out visitor reads the groups and holds no entries
            var userId = await userManager.GetUserIdAsync(context);

            // The view as it stands for them
            var view = await competitionService.GetViewAsync(userId, context.RequestAborted);

            // Return it
            return Results.Ok(view);
        })
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // What an entry still needs of the caller
        app.MapGet($"{CompetitionsPath}/readiness", async (
            HttpContext context,
            IUserManager userManager,
            IHostedCompetitionService competitionService) =>
        {
            // Resolve the calling user
            var userId = await userManager.RequireUserIdAsync(context);

            // What their account already holds
            var readiness = await competitionService.GetReadinessAsync(userId, context.RequestAborted);

            // Return it
            return Results.Ok(readiness);
        })
        .RequireAuthorization()
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Take the entry: the clock starts, and the problems it bought come back with it
        app.MapPost($"{CompetitionsPath}/{{roundId:guid}}/entry", async (
            Guid roundId,
            HttpContext context,
            IUserManager userManager,
            IHostedCompetitionService competitionService) =>
        {
            // Resolve the calling user
            var userId = await userManager.RequireUserIdAsync(context);

            // Spend the entry by sitting it
            var spent = await competitionService.EnterAsync(userId, roundId, context.RequestAborted);

            // Return the entry and the problems it opens
            return Results.Ok(spent);
        })
        .RequireAuthorization()
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Give the entry up for the problems: no clock ever runs
        app.MapPost($"{CompetitionsPath}/{{roundId:guid}}/forfeit", async (
            Guid roundId,
            HttpContext context,
            IUserManager userManager,
            IHostedCompetitionService competitionService) =>
        {
            // Resolve the calling user
            var userId = await userManager.RequireUserIdAsync(context);

            // Spend the entry by giving it up
            var spent = await competitionService.ForfeitAsync(userId, roundId, context.RequestAborted);

            // Return the entry and the problems it opens
            return Results.Ok(spent);
        })
        .RequireAuthorization()
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Close a running entry where the student says rather than where its clock does
        app.MapPost($"{CompetitionsPath}/{{roundId:guid}}/finish", async (
            Guid roundId,
            HttpContext context,
            IUserManager userManager,
            IHostedCompetitionService competitionService) =>
        {
            // Resolve the calling user
            var userId = await userManager.RequireUserIdAsync(context);

            // Close the running entry
            var entry = await competitionService.FinishAsync(userId, roundId, context.RequestAborted);

            // Return the entry as it now stands
            return Results.Ok(entry);
        })
        .RequireAuthorization()
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // The problems an entry opens, with whatever the student has said about each
        app.MapGet($"{CompetitionsPath}/{{roundId:guid}}/problems", async (
            Guid roundId,
            HttpContext context,
            IUserManager userManager,
            IHostedCompetitionService competitionService) =>
        {
            // Resolve the calling user
            var userId = await userManager.RequireUserIdAsync(context);

            // The problems the entry opens
            var problems = await competitionService.GetProblemsAsync(userId, roundId, context.RequestAborted);

            // Return them
            return Results.Ok(problems);
        })
        .RequireAuthorization()
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);
    }
}

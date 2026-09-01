using MathComps.Api.Constants;
using MathComps.Domain.Contracts.Competitions;
using MathComps.Infrastructure.Services.Competitions;
using MathComps.Infrastructure.Services.Users;

namespace MathComps.Api.Endpoints;

/// <summary>
/// Maps the endpoints behind the competitions the site hosts itself: reading the groups, reading what an entry
/// needs of the caller, spending an entry (by sitting it or by giving it up for the problems), closing one early,
/// reading a competition's problems, and recording what the student makes of their own solutions.
/// </summary>
/// <remarks>
/// The problems route is the only place an embargoed problem is served, and it serves one only to a caller who
/// has spent an entry into its competition. Everywhere else in the site an embargoed round stays invisible. Once
/// a competition is over its set is something anybody may read, so that route also answers a caller with no
/// account, as the groups list does.
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

        // The caller asking not to be told about their unfinished profile again
        app.MapPost($"{CompetitionsPath}/readiness/dismissal", async (
            HttpContext context,
            IUserManager userManager,
            IHostedCompetitionService competitionService) =>
        {
            // Resolve the calling user
            var userId = await userManager.RequireUserIdAsync(context);

            // Take their word for it
            await competitionService.DismissProfilePromptAsync(userId, context.RequestAborted);

            // No reason to return anything
            return Results.NoContent();
        })
        .RequireAuthorization()
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Take the entry: the clock starts, and the problems it bought come back with it
        app.MapPost($"{CompetitionsPath}/{{competitionSlug}}/entry", async (
            string competitionSlug,
            HttpContext context,
            IUserManager userManager,
            IHostedCompetitionService competitionService) =>
        {
            // Resolve the calling user
            var userId = await userManager.RequireUserIdAsync(context);

            // Spend the entry by sitting it
            var spent = await competitionService.EnterAsync(userId, competitionSlug, context.RequestAborted);

            // Return the entry and the problems it opens
            return Results.Ok(spent);
        })
        .RequireAuthorization()
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Give the entry up for the problems: no clock ever runs
        app.MapPost($"{CompetitionsPath}/{{competitionSlug}}/forfeit", async (
            string competitionSlug,
            HttpContext context,
            IUserManager userManager,
            IHostedCompetitionService competitionService) =>
        {
            // Resolve the calling user
            var userId = await userManager.RequireUserIdAsync(context);

            // Spend the entry by giving it up
            var spent = await competitionService.ForfeitAsync(userId, competitionSlug, context.RequestAborted);

            // Return the entry and the problems it opens
            return Results.Ok(spent);
        })
        .RequireAuthorization()
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Close a running entry where the student says rather than where its clock does
        app.MapPost($"{CompetitionsPath}/{{competitionSlug}}/finish", async (
            string competitionSlug,
            HttpContext context,
            IUserManager userManager,
            IHostedCompetitionService competitionService) =>
        {
            // Resolve the calling user
            var userId = await userManager.RequireUserIdAsync(context);

            // Close the running entry
            var entry = await competitionService.FinishAsync(userId, competitionSlug, context.RequestAborted);

            // Return the entry as it now stands
            return Results.Ok(entry);
        })
        .RequireAuthorization()
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // A competition's problems, with whatever the student has said about each
        app.MapGet($"{CompetitionsPath}/{{competitionSlug}}/problems", async (
            string competitionSlug,
            HttpContext context,
            IUserManager userManager,
            IHostedCompetitionService competitionService) =>
        {
            // Resolve the calling user, a competition read after it closed often having none
            var userId = await userManager.GetUserIdAsync(context);

            // The problems this caller may read
            var problems = await competitionService.GetProblemsAsync(userId, competitionSlug, context.RequestAborted);

            // Return them
            return Results.Ok(problems);
        })
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Record what the student makes of their own solution to one of the set, replacing what they said before
        app.MapPut($"{CompetitionsPath}/{{competitionSlug}}/problems/{{problemId:guid}}/assessment", async (
            string competitionSlug,
            Guid problemId,
            SetProblemSelfAssessmentRequest request,
            HttpContext context,
            IUserManager userManager,
            IHostedCompetitionService competitionService) =>
        {
            // Resolve the calling user
            var userId = await userManager.RequireUserIdAsync(context);

            // Record the claim
            await competitionService.SetSelfAssessmentAsync(
                userId, competitionSlug, problemId, request.Comment, context.RequestAborted);

            // Nothing to hand back: the claim is what the caller already holds
            return Results.NoContent();
        })
        .RequireAuthorization()
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Take back what the student said about their own solution to one of the set
        app.MapDelete($"{CompetitionsPath}/{{competitionSlug}}/problems/{{problemId:guid}}/assessment", async (
            string competitionSlug,
            Guid problemId,
            HttpContext context,
            IUserManager userManager,
            IHostedCompetitionService competitionService) =>
        {
            // Resolve the calling user
            var userId = await userManager.RequireUserIdAsync(context);

            // Drop the claim
            await competitionService.ClearSelfAssessmentAsync(
                userId, competitionSlug, problemId, context.RequestAborted);

            // Nothing stands against the problem now
            return Results.NoContent();
        })
        .RequireAuthorization()
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);
    }
}

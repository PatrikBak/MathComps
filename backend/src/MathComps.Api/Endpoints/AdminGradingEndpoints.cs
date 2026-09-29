using MathComps.Api.Constants;
using MathComps.Domain.Contracts.Admin;
using MathComps.Infrastructure.Services.Admin;
using MathComps.Infrastructure.Services.Users;

namespace MathComps.Api.Endpoints;

/// <summary>
/// Maps the endpoints for grading the hosted groups, gated by the <see cref="AuthorizationPolicies.Admin"/>
/// policy.
/// </summary>
public static class AdminGradingEndpoints
{
    /// <summary>
    /// The base path the grading endpoints hang off.
    /// </summary>
    private const string GradingPath = "/admin/grading";

    /// <summary>
    /// Maps the <c>/admin/grading</c> endpoints onto the route builder.
    /// </summary>
    /// <param name="app">The route builder to register the endpoints on.</param>
    public static void MapAdminGradingEndpoints(this IEndpointRouteBuilder app)
    {
        // Read everything grading one group starts from
        app.MapGet($"{GradingPath}/groups/{{slug}}", async (
            string slug,
            IAdminGradingService gradingService,
            CancellationToken cancellationToken) =>
        {
            // The board
            var board = await gradingService.GetBoardAsync(slug, cancellationToken);

            // Return it
            return Results.Ok(board);
        })
        .RequireAuthorization(AuthorizationPolicies.Admin)
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Change one student's grade on one problem
        app.MapPatch($"{GradingPath}/problems/{{problemId:guid}}/students/{{userId:guid}}", async (
            Guid problemId,
            Guid userId,
            UpdateGradeRequest request,
            HttpContext context,
            IUserManager userManager,
            IAdminGradingService gradingService,
            CancellationToken cancellationToken) =>
        {
            // A change carrying nothing names nothing to change, so it is refused
            if (request is { Mark: null, Help: null, InternalComment: null, IsFinal: null })
                throw new BadHttpRequestException("A grade change must carry something to change.");

            // The grader making it, taken from the caller rather than from what they sent
            var graderId = await userManager.RequireUserIdAsync(context);

            // Apply the change
            var grade = await gradingService.UpdateGradeAsync(
                graderId, problemId, userId, request, cancellationToken);

            // Return it, or nothing while a change that moved nothing left the student ungraded on the problem
            return grade is null ? Results.NoContent() : Results.Ok(grade);
        })
        .RequireAuthorization(AuthorizationPolicies.Admin)
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);
    }
}

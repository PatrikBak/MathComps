using MathComps.Api.Constants;
using MathComps.Domain.Contracts.Users;
using MathComps.Infrastructure.Services.Users;

namespace MathComps.Api.Endpoints;

/// <summary>
/// Maps the authenticated user's own account endpoints: reading and recording their acknowledgement of what
/// talking to the AI tutor entails.
/// </summary>
public static class UserEndpoints
{
    /// <summary>
    /// Path the AI-consent routes live at.
    /// </summary>
    private const string AiConsentPath = "/users/me/ai-consent";

    /// <summary>
    /// Maps the <c>/users/me</c> endpoints onto the route builder.
    /// </summary>
    /// <param name="app">The route builder to register the endpoints on.</param>
    public static void MapUserEndpoints(this IEndpointRouteBuilder app)
    {
        // Read where the authenticated user stands on the AI tutor
        app.MapGet(AiConsentPath, async (
            HttpContext context,
            IUserManager userManager) =>
        {
            // Resolve the caller, faulting when the request has no user behind it
            var userId = await userManager.RequireUserIdAsync(context);

            // Read when they acknowledged it
            var consentedAt = await userManager.GetAiConsentAsync(userId, context.RequestAborted);

            // Return where they stand
            return Results.Ok(new AiConsentDto(consentedAt));
        })
        .RequireAuthorization()
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Record that the authenticated user has been told
        app.MapPost(AiConsentPath, async (
            HttpContext context,
            IUserManager userManager) =>
        {
            // Resolve the caller, faulting when the request has no user behind it
            var userId = await userManager.RequireUserIdAsync(context);

            // Stamp the acknowledgement
            await userManager.RecordAiConsentAsync(userId, context.RequestAborted);

            // No reason to return anything
            return Results.NoContent();
        })
        .RequireAuthorization()
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);
    }
}

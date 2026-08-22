using MathComps.Api.Constants;
using MathComps.Domain.Contracts.Users;
using MathComps.Infrastructure.Services.Users;

namespace MathComps.Api.Endpoints;

/// <summary>
/// Maps the authenticated user's own account endpoints: reading and recording their acknowledgement of what
/// talking to the AI tutor entails, taking the username the site calls them by, and reading and replacing what
/// they have told us about their competing.
/// </summary>
public static class UserEndpoints
{
    /// <summary>
    /// Path the AI-consent routes live at.
    /// </summary>
    private const string AiConsentPath = "/users/me/ai-consent";

    /// <summary>
    /// Path the username route lives at.
    /// </summary>
    private const string UsernamePath = "/users/me/username";

    /// <summary>
    /// Path the profile route lives at.
    /// </summary>
    private const string ProfilePath = "/users/me/profile";

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

        // Read what the authenticated user has told us about themselves
        app.MapGet(ProfilePath, async (
            HttpContext context,
            IUserManager userManager) =>
        {
            // Resolve the caller, faulting when the request has no user behind it
            var userId = await userManager.RequireUserIdAsync(context);

            // Read their profile, faulting when the row they were resolved from has gone
            var profile = await userManager.GetProfileAsync(userId, context.RequestAborted)
                ?? throw new UserNotResolvedException();

            // Return what we hold on them
            return Results.Ok(profile);
        })
        .RequireAuthorization()
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Take the username the authenticated user will be known by
        app.MapPost(UsernamePath, async (
            SetUsernameRequest request,
            HttpContext context,
            IUserManager userManager) =>
        {
            // Resolve the caller, faulting when the request has no user behind it
            var userId = await userManager.RequireUserIdAsync(context);

            // Take it, faulting when it is somebody else's, malformed, or they already have one
            await userManager.SetUsernameAsync(userId, request.Username, context.RequestAborted);

            // No reason to return anything
            return Results.NoContent();
        })
        .RequireAuthorization()
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Replace what the authenticated user has told us about their competing
        app.MapPut(ProfilePath, async (
            UpdateUserProfileRequest request,
            HttpContext context,
            IUserManager userManager) =>
        {
            // Resolve the caller, faulting when the request has no user behind it
            var userId = await userManager.RequireUserIdAsync(context);

            // Write what they said, faulting when any of it is outside what it may say
            await userManager.UpdateProfileAsync(userId, request, context.RequestAborted);

            // No reason to return anything
            return Results.NoContent();
        })
        .RequireAuthorization()
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);
    }
}

using MathComps.Api.Constants;

namespace MathComps.Api.Endpoints;

/// <summary>
/// The authenticated admin's identity, echoed back from the JWT claims.
/// </summary>
/// <param name="ExternalId">The caller's Clerk external user id.</param>
/// <param name="Role">The caller's Role claim.</param>
public record AdminWhoamiResponse(string ExternalId, string? Role);

/// <summary>
/// Maps the admin-only endpoints, gated by the <see cref="AuthorizationPolicies.Admin"/> policy.
/// </summary>
public static class AdminEndpoints
{
    /// <summary>
    /// Maps the <c>/admin</c> endpoints onto the route builder.
    /// </summary>
    /// <param name="app">The route builder to register the endpoints on.</param>
    public static void MapAdminEndpoints(this IEndpointRouteBuilder app)
    {
        // Echo the caller's identity — reaching a 200 here proves the admin policy passed
        app.MapGet("/admin/whoami", (HttpContext context) =>
        {
            // Read Clerk's external id from the subject claim
            var externalId = context.User.FindFirst(ClerkClaims.Subject)?.Value ?? string.Empty;

            // Read the flat Role claim
            var role = context.User.FindFirst(ClerkClaims.RoleClaimType)?.Value;

            // Return the identity
            return Results.Ok(new AdminWhoamiResponse(externalId, role));
        })
        .RequireAuthorization(AuthorizationPolicies.Admin)
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);
    }
}

using MathComps.Api.Authorization;
using MathComps.Api.Constants;
using Microsoft.AspNetCore.Authorization;

namespace MathComps.Api.Extensions;

/// <summary>
/// Extension methods for configuring authorization.
/// </summary>
public static class AuthorizationExtensions
{
    /// <summary>
    /// Adds the authorization policies endpoints require, and what looks the caller's account up on an organization's
    /// list.
    /// </summary>
    /// <param name="services">The service collection to configure.</param>
    /// <returns>The configured service collection for chaining.</returns>
    public static IServiceCollection AddApiAuthorization(this IServiceCollection services)
    {
        // The policies, each by the accounts it lets in
        services.AddAuthorizationBuilder()
            .AddPolicy(AuthorizationPolicies.Admin, policy => policy.RequireRole(ClerkClaims.AdminRole))
            .AddPolicy(AuthorizationPolicies.OrganizationMember, policy => policy
                .RequireAuthenticatedUser()
                .AddRequirements(new OrganizationMemberRequirement()));

        // What looks the caller's account up on an organization's list
        services.AddScoped<IAuthorizationHandler, OrganizationMemberHandler>();

        // Return the services for chaining
        return services;
    }
}

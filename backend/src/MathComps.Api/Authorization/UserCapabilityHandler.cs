using MathComps.Api.Constants;
using MathComps.Api.Endpoints;
using MathComps.Infrastructure.Services.Users;
using Microsoft.AspNetCore.Authorization;

namespace MathComps.Api.Authorization;

/// <summary>
/// Meets a <see cref="UserCapabilityRequirement"/> when the caller resolves to an account holding the capability, or
/// is an admin where the requirement admits admins. A grant is read afresh on every request, so revoking one closes
/// the door on the next.
/// </summary>
/// <param name="userManager">Resolves the caller to their account.</param>
/// <param name="grants">Reads what the account holds.</param>
public sealed class UserCapabilityHandler(IUserManager userManager, IUserGrantService grants)
    : AuthorizationHandler<UserCapabilityRequirement>
{
    /// <inheritdoc/>
    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context, UserCapabilityRequirement requirement)
    {
        // An admin, where the requirement lets admins in, needs no grant
        if (requirement.AdmitsAdmins && context.User.IsInRole(ClerkClaims.AdminRole))
        {
            // Met
            context.Succeed(requirement);

            // Nothing more to read
            return;
        }

        // The request being authorized, which is what an endpoint's authorization is handed
        if (context.Resource is not HttpContext httpContext)
            return;

        // The caller's account, which an anonymous or unknown caller has none of
        if (await userManager.GetUserIdAsync(httpContext) is not { } userId)
            return;

        // Met only where a grant of the capability stands against the account
        if (await grants.HasAsync(userId, requirement.Capability, httpContext.RequestAborted))
            context.Succeed(requirement);
    }
}

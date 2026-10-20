using MathComps.Api.Constants;
using MathComps.Api.Endpoints;
using MathComps.Infrastructure.Services.Organizations;
using MathComps.Infrastructure.Services.Users;
using Microsoft.AspNetCore.Authorization;

namespace MathComps.Api.Authorization;

/// <summary>
/// Meets an <see cref="OrganizationMemberRequirement"/> when the caller resolves to an account that is a member of
/// the requirement's organization, or is an admin where the requirement admits admins. The list is read afresh on
/// every request, so taking an address off it closes the door on the next.
/// </summary>
/// <param name="userManager">Resolves the caller to their account.</param>
/// <param name="members">Reads who is on the organization's list.</param>
public sealed class OrganizationMemberHandler(IUserManager userManager, IOrganizationMemberService members)
    : AuthorizationHandler<OrganizationMemberRequirement>
{
    /// <inheritdoc/>
    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context, OrganizationMemberRequirement requirement)
    {
        // An admin, where the requirement lets admins in, needs no membership
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

        // Met only where the account's address is on the organization's list
        if (await members.IsMemberAsync(userId, requirement.OrganizationSlug, httpContext.RequestAborted))
            context.Succeed(requirement);
    }
}

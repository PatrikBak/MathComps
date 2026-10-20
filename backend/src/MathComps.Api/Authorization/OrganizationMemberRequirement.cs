using Microsoft.AspNetCore.Authorization;

namespace MathComps.Api.Authorization;

/// <summary>
/// Requires the caller's account to be a member of the organization the route names by its slug.
/// </summary>
public sealed class OrganizationMemberRequirement : IAuthorizationRequirement
{
    /// <summary>
    /// The route value naming the organization by its slug.
    /// </summary>
    public const string OrganizationRouteValue = "organization";
}

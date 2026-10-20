using MathComps.Api.Authorization;

namespace MathComps.Api.Constants;

/// <summary>
/// Constants for authorization policy names used throughout the API.
/// </summary>
public static class AuthorizationPolicies
{
    /// <summary>
    /// Restricts an endpoint to users carrying the admin Role.
    /// </summary>
    public const string Admin = "Admin";

    /// <summary>
    /// Restricts an endpoint to the members of the organization its route names, by the route value
    /// <see cref="OrganizationMemberRequirement.OrganizationRouteValue"/>.
    /// </summary>
    public const string OrganizationMember = "OrganizationMember";
}

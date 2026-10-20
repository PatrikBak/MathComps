using MathComps.Domain.EfCoreEntities;
using Microsoft.AspNetCore.Authorization;

namespace MathComps.Api.Authorization;

/// <summary>
/// Requires the caller's account to be a member of an organization.
/// </summary>
/// <param name="OrganizationSlug">
/// The <see cref="Organization.Slug"/> of the organization the account has to be a member of.
/// </param>
public sealed record OrganizationMemberRequirement(string OrganizationSlug) : IAuthorizationRequirement;

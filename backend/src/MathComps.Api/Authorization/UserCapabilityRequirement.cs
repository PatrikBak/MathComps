using MathComps.Domain.EfCoreEntities;
using Microsoft.AspNetCore.Authorization;

namespace MathComps.Api.Authorization;

/// <summary>
/// Requires the caller's account to hold a capability, or the caller to be an admin where admins are let in too.
/// </summary>
/// <param name="Capability">The capability the account has to hold.</param>
/// <param name="AdmitsAdmins">Whether an admin is let in without holding the capability.</param>
public sealed record UserCapabilityRequirement(UserCapability Capability, bool AdmitsAdmins = false)
    : IAuthorizationRequirement;

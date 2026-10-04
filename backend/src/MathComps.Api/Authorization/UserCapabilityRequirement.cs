using MathComps.Domain.EfCoreEntities;
using Microsoft.AspNetCore.Authorization;

namespace MathComps.Api.Authorization;

/// <summary>
/// Requires the caller's account to hold a capability.
/// </summary>
/// <param name="Capability">The capability the account has to hold.</param>
public sealed record UserCapabilityRequirement(UserCapability Capability) : IAuthorizationRequirement;

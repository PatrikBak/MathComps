using MathComps.Domain.EfCoreEntities;

namespace MathComps.Domain.Contracts.Users;

/// <summary>
/// What the authenticated user has told us about themselves.
/// </summary>
/// <param name="Username"><inheritdoc cref="User.Username" path="/summary"/></param>
public record UserProfileDto(string? Username);

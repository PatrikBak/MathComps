using MathComps.Domain.EfCoreEntities;

namespace MathComps.Infrastructure.Services;

/// <summary>
/// Data transfer object for synchronizing user data from external providers (e.g., Clerk).
/// </summary>
/// <param name="ExternalId"><inheritdoc cref="User.ExternalId" path="/summary"/></param>
/// <param name="Email"><inheritdoc cref="User.Email" path="/summary"/></param>
/// <param name="DisplayName"><inheritdoc cref="User.DisplayName" path="/summary"/></param>
/// <param name="AvatarUrl"><inheritdoc cref="User.AvatarUrl" path="/summary"/></param>
public record UserSyncDto(
    string ExternalId,
    string? Email,
    string DisplayName,
    string? AvatarUrl
);

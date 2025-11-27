using MathComps.Domain.EfCoreEntities;

namespace MathComps.Infrastructure.Services;

/// <summary>
/// Data transfer object for synchronizing user data from external providers (e.g., Clerk).
/// </summary>
/// <param name="ExternalId"><inheritdoc cref="User.ExternalId" path="/summary"/></param>
/// <param name="Email"><inheritdoc cref="User.Email" path="/summary"/></param>
/// <param name="FirstName"><inheritdoc cref="User.FirstName" path="/summary"/></param>
/// <param name="LastName"><inheritdoc cref="User.LastName" path="/summary"/></param>
public record UserSyncDto(
    string ExternalId,
    string Email,
    string? FirstName,
    string? LastName
);

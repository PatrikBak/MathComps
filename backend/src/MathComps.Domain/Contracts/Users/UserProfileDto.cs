using MathComps.Domain.EfCoreEntities;

namespace MathComps.Domain.Contracts.Users;

/// <summary>
/// The authenticated user's own account details.
/// </summary>
/// <param name="Email"><inheritdoc cref="User.Email" path="/summary"/></param>
/// <param name="Username"><inheritdoc cref="User.Username" path="/summary"/></param>
/// <param name="GraduationYear"><inheritdoc cref="User.GraduationYear" path="/summary"/></param>
/// <param name="HasLeftHighSchool"><inheritdoc cref="User.HasLeftHighSchool" path="/summary"/></param>
/// <param name="CountryCode"><inheritdoc cref="User.CountryCode" path="/summary"/></param>
public record UserProfileDto(
    string? Email, string? Username, int? GraduationYear, bool HasLeftHighSchool, string? CountryCode);

using MathComps.Domain.EfCoreEntities;

namespace MathComps.Domain.Contracts.Users;

/// <summary>
/// Request to replace what the authenticated user has told us about their competing.
/// </summary>
/// <remarks>
/// Every field is stated every time, so a null means cleared.
/// </remarks>
/// <param name="GraduationYear"><inheritdoc cref="User.GraduationYear" path="/summary"/></param>
/// <param name="HasLeftHighSchool"><inheritdoc cref="User.HasLeftHighSchool" path="/summary"/></param>
/// <param name="CountryCode"><inheritdoc cref="User.CountryCode" path="/summary"/></param>
public record UpdateUserProfileRequest(
    int? GraduationYear, bool HasLeftHighSchool, string? CountryCode);

namespace MathComps.Domain.Contracts.Competitions;

/// <summary>
/// Who a row of a competition's results belongs to, as much of their profile as the results show.
/// </summary>
/// <param name="Username">The permanent name, or null for an account since deleted.</param>
/// <param name="AvatarUrl">The URL of their avatar image, or null where they have none.</param>
/// <param name="CountryCode">
/// Where they compete from as an ISO 3166-1 alpha-2 code, or null while they have not said and for an account since
/// deleted.
/// </param>
/// <param name="Grade">Where they were in school when the competition's group opened.</param>
public record ResultStudentDto(string? Username, string? AvatarUrl, string? CountryCode, SchoolGradeDto Grade);

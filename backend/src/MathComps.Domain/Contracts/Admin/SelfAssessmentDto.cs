namespace MathComps.Domain.Contracts.Admin;

/// <summary>
/// What a student said about their own solution to one problem.
/// </summary>
/// <param name="Comment">What they said, in their own words.</param>
/// <param name="UpdatedAt">When they last changed it.</param>
public record SelfAssessmentDto(string Comment, DateTimeOffset UpdatedAt);

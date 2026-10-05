namespace MathComps.Domain.Contracts.Admin;

/// <summary>
/// One entrant's grade on a problem named elsewhere.
/// </summary>
/// <param name="UserId">The entrant.</param>
/// <param name="Grade"><inheritdoc cref="GradeDto" path="/summary"/></param>
public record StudentGradeDto(Guid UserId, GradeDto Grade);

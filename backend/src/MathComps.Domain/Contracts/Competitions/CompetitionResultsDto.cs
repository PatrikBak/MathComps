namespace MathComps.Domain.Contracts.Competitions;

/// <summary>
/// One competition's results.
/// </summary>
/// <param name="Rows">
/// Every graded student who held a conversation about its problems inside their entry, in the order they stand.
/// </param>
public record CompetitionResultsDto(IReadOnlyList<ResultRowDto> Rows);

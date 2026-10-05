namespace MathComps.Domain.Contracts.Competitions;

/// <summary>
/// One student's row of a competition's results.
/// </summary>
/// <param name="Place">
/// Where they stand, from 1, shared with any row level with it; null while nothing of theirs has a final grade.
/// </param>
/// <param name="Student">Who it is.</param>
/// <param name="IsReader">Whether the row is the reader's own.</param>
/// <param name="Cells">One per problem, in the order the competition sets them.</param>
public record ResultRowDto(int? Place, ResultStudentDto Student, bool IsReader, IReadOnlyList<ResultCellDto> Cells);

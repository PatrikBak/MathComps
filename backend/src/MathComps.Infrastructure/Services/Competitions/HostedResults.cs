using MathComps.Domain.Contracts.Competitions;

namespace MathComps.Infrastructure.Services.Competitions;

/// <summary>
/// What a hosted competition's results are made of: what each grade shows as, and the order the rows stand in.
/// </summary>
internal static class HostedResults
{
    /// <summary>
    /// What a graded entry's standing on a problem shows as.
    /// </summary>
    /// <param name="grading">The entry's counted conversations and grade on the problem.</param>
    extension(HostedGrading.ProblemGrading grading)
    {
        /// <summary>
        /// What one graded entry's standing on one problem shows as in the results.
        /// </summary>
        public ResultCellDto Cell =>
            // Nothing written about it inside the window leaves nothing to mark
            grading.Conversations == 0 ? new NoConversationCellDto()
            // A final grade is scored as the mark less half of the help
            : grading.Final is { } final ? new ScoredCellDto(final.Mark - (final.Help / 2m))
            // Anything else waits on the graders
            : new PendingCellDto();

        /// <summary>
        /// The mark and the help of the grade, or null while it is not final.
        /// </summary>
        /// <exception cref="InvalidOperationException">A final grade carries no mark.</exception>
        private (int Mark, int Help)? Final =>
            // Only a final grade counts, and the grading rules give every one of those a mark
            grading.Grade is { IsFinal: true } grade
                ? (grade.Mark ?? throw new InvalidOperationException("A final grade carries no mark."), grade.Help)
                : null;
    }

    /// <summary>
    /// What one graded entry's standing on one problem shows as to the student themselves.
    /// </summary>
    /// <param name="grading">The entry's counted conversations and grade on the problem.</param>
    /// <param name="problemId">The problem.</param>
    /// <param name="userId">The student.</param>
    /// <param name="messageCount">
    /// How many messages stand in the conversation about the grade, replies included and deleted ones not.
    /// </param>
    /// <returns>The student's result on the problem.</returns>
    public static ProblemResultDto ResultOf(
        HostedGrading.ProblemGrading grading, Guid problemId, Guid userId, int messageCount) =>
        // Nothing written about it inside the window leaves nothing to mark
        grading.Conversations == 0 ? new NoConversationResultDto()
        // A final grade, with the conversation about it that it opens
        : grading.Final is { } final
            ? new FinalResultDto(
                final.Mark,
                final.Help,
                new GradeConversationDto(HostedGrading.ConversationTargetId(problemId, userId), messageCount))
        // Anything else waits on the graders
        : new PendingResultDto();

    /// <summary>
    /// Puts results rows in the order they stand and gives each its place. The best total comes first, a tie
    /// going to the smaller <see cref="UnplacedRow.FinishedAfter"/>, and rows level on both share a place. Rows
    /// with no total stand after everyone, unplaced and by name.
    /// </summary>
    /// <param name="rows">The rows, in no order.</param>
    /// <returns>The rows in the order they stand, placed.</returns>
    public static IReadOnlyList<ResultRowDto> Place(IReadOnlyList<UnplacedRow> rows)
    {
        // Each row with its total, the sum of its scored cells where it has any
        var totalled = rows
            .Select(row => (
                Row: row,
                Total: row.Cells.OfType<ScoredCellDto>().Select(cell => cell.Score).ToList() is { Count: > 0 } scores
                    ? scores.Sum()
                    : (decimal?)null))
            .ToList();

        // Totals first, the best on top and the smaller FinishedAfter on a tie; those with none last; names settle
        // the rest
        var ordered = totalled
            .OrderBy(row => row.Total is null)
            .ThenByDescending(row => row.Total)
            .ThenBy(row => row.Total is null ? TimeSpan.Zero : row.Row.FinishedAfter)
            .ThenBy(row => row.Row.Student.Username is null)
            .ThenBy(row => row.Row.Student.Username, StringComparer.InvariantCultureIgnoreCase)
            .ToList();

        // Each row with a total takes the place of the first row level with it on the total and the finishing time
        return
        [
            .. ordered.Select(row => new ResultRowDto(
                row.Total is null
                    ? null
                    : ordered.FindIndex(other =>
                        other.Total == row.Total && other.Row.FinishedAfter == row.Row.FinishedAfter) + 1,
                row.Row.Student,
                row.Row.IsReader,
                row.Row.Cells)),
        ];
    }

    /// <summary>
    /// One student's row of the results before it is placed.
    /// </summary>
    /// <param name="Student"><inheritdoc cref="ResultRowDto.Student" path="/summary"/></param>
    /// <param name="IsReader"><inheritdoc cref="ResultRowDto.IsReader" path="/summary"/></param>
    /// <param name="Cells"><inheritdoc cref="ResultRowDto.Cells" path="/summary"/></param>
    /// <param name="FinishedAfter">
    /// <inheritdoc cref="HostedGrading.ProblemGradings.FinishedAfter" path="/summary"/>
    /// </param>
    public sealed record UnplacedRow(
        ResultStudentDto Student, bool IsReader, IReadOnlyList<ResultCellDto> Cells, TimeSpan FinishedAfter);
}

using MathComps.Cli.Examiner.Fixtures;

namespace MathComps.Cli.Examiner.Engine;

/// <summary>
/// Produces the examiner's next reply for a defense conversation, running the generate → verify → revise loop that
/// keeps the reply mathematically sound and free of unearned hints.
/// </summary>
public interface IExaminer
{
    /// <summary>
    /// Runs one examiner turn over the fixture's transcript, returning the reply together with what the loop did to
    /// produce it.
    /// </summary>
    /// <param name="fixture">The problem, reference, and transcript the reply is generated from.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>The examiner's next reply and the loop's trace.</returns>
    Task<ExaminerTurnOutcome> NextReplyAsync(Fixture fixture, CancellationToken cancellationToken = default);
}

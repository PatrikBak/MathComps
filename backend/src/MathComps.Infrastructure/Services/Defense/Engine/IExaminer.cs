namespace MathComps.Infrastructure.Services.Defense.Engine;

/// <summary>
/// Produces the examiner's next reply for a defense conversation: mathematically sound and free of unearned hints.
/// </summary>
public interface IExaminer
{
    /// <summary>
    /// Runs one examiner turn over a conversation, returning the reply together with the turn's guard verdicts,
    /// revision count, and cost. The transcript's last turn must be the candidate's — the examiner replies to the
    /// candidate.
    /// </summary>
    /// <param name="problem">The problem statement, seen by both sides.</param>
    /// <param name="reference">The reference solution, the examiner's ground truth for the problem's facts.</param>
    /// <param name="transcript">The conversation so far, ending on a candidate turn.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>The examiner's next reply and the turn's outcome.</returns>
    Task<ExaminerTurnOutcome> NextReplyAsync(
        string problem, string reference, Transcript transcript, CancellationToken cancellationToken = default);
}

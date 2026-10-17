using MathComps.Infrastructure.Services.Ai;

namespace MathComps.Infrastructure.Services.Defense.Engine;

/// <summary>
/// Produces the examiner's next reply for a defense conversation, mathematically sound and free of unearned hints, and
/// judges a given reply by the same checks. This is an AI examiner, so the contract deals in model usage (a turn's cost
/// and tokens), which the caller supplies and reads.
/// </summary>
public interface IExaminer
{
    /// <summary>
    /// Runs one examiner turn over a conversation, returning the reply together with the turn's guard verdicts,
    /// revision count, and cost. Each model call's usage is folded into <paramref name="usage"/> as it lands, so a
    /// caller can read the partial spend even when the turn is cancelled before it returns. The conversation's last
    /// turn must be the candidate's — the examiner replies to the candidate.
    /// </summary>
    /// <param name="input"><inheritdoc cref="ExaminerInput" path="/summary"/></param>
    /// <param name="usage">The turn's running spend accumulator.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>The examiner's next reply and the turn's outcome.</returns>
    Task<ExaminerTurnOutcome> NextReplyAsync(
        ExaminerInput input, ModelUsageAccumulator usage, CancellationToken cancellationToken = default);

    /// <summary>
    /// Runs every guard over a given reply, as if the examiner had drafted it in answer to the conversation, and
    /// returns their verdicts. Nothing is generated or revised. Each guard call's usage is folded into
    /// <paramref name="usage"/> as it lands. The conversation's last turn must be the candidate's, the turn the reply
    /// answers.
    /// </summary>
    /// <param name="input"><inheritdoc cref="ExaminerInput" path="/summary"/></param>
    /// <param name="reply">The examiner reply to judge.</param>
    /// <param name="usage">The running spend accumulator.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>The reply as one judged attempt: every guard's verdict and the calls that produced them.</returns>
    Task<ExaminerAttempt> CheckReplyAsync(
        ExaminerInput input, string reply, ModelUsageAccumulator usage, CancellationToken cancellationToken = default);
}

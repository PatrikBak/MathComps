using MathComps.Infrastructure.Services.Ai;

namespace MathComps.Infrastructure.Services.Defense.Engine;

/// <summary>
/// The result of one examiner turn: every attempt it made, whether it ended on the constrained fallback, and the
/// turn's usage summed over every model call. The attempt that ships is the last one, so the shipped reply and the
/// verdicts it shipped under are read off <see cref="Shipped"/> rather than repeated here.
/// </summary>
/// <param name="Attempts">Every attempt the turn made, in the order they were generated; never empty.</param>
/// <param name="SafeFallback">Whether the revision cap ran out with a wrong claim or a mis-paid step still on the
/// reply, so the last attempt is the constrained fallback rather than a normal one.</param>
/// <param name="Usage">The turn's total spend and token counts, summed over every model call it made.</param>
public record ExaminerTurnOutcome(
    IReadOnlyList<ExaminerAttempt> Attempts,
    bool SafeFallback,
    ModelUsage Usage)
{
    /// <summary>
    /// The attempt that ships, which is the last one the turn generated.
    /// </summary>
    public ExaminerAttempt Shipped => Attempts[^1];

    /// <summary>
    /// How many times the reply was regenerated because a guard flagged it, the fallback generation included
    /// (0 when the first attempt shipped clean).
    /// </summary>
    public int Revisions => Attempts.Count - 1;
}

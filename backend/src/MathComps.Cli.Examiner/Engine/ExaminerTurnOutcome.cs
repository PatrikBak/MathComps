using MathComps.Cli.Examiner.Dtos;

namespace MathComps.Cli.Examiner.Engine;

/// <summary>
/// The result of one examiner turn: the reply that ships, plus the two guards' verdicts on it and how many times the
/// reply was regenerated. The verdicts are the ones on the shipped reply — so a non-zero <paramref name="Revisions"/>
/// alongside <see cref="MathCheckResult.Holds"/> false or <see cref="LeakCheckResult.Leaks"/> true means the retries
/// ran out before the flaw was fixed.
/// </summary>
/// <param name="Reply">The examiner's shipped reply.</param>
/// <param name="MathCheck">The math-check verdict on the shipped reply.</param>
/// <param name="LeakCheck">The leak-check verdict on the shipped reply.</param>
/// <param name="Revisions">How many times the reply was regenerated because a guard flagged it (0 when clean first try).</param>
public record ExaminerTurnOutcome(
    string Reply,
    MathCheckResult MathCheck,
    LeakCheckResult LeakCheck,
    int Revisions);

using MathComps.Infrastructure.Services.Ai;
using MathComps.Infrastructure.Services.Defense.Dtos;

namespace MathComps.Infrastructure.Services.Defense.Engine;

/// <summary>
/// The result of one examiner turn: the reply that ships, the two guards' verdicts on it, how many times the reply
/// was regenerated, and the turn's usage (the summed spend and token counts of every model call it made: the first
/// attempt, both guards, and every revision). The verdicts are the ones on the shipped reply, so a non-zero
/// <paramref name="Revisions"/> alongside <see cref="MathCheckResult.Holds"/> false or
/// <see cref="LeakCheckResult.Leaks"/> true means the retries ran out before the flaw was fixed.
/// </summary>
/// <param name="Reply">The examiner's shipped reply.</param>
/// <param name="MathCheck">The math-check verdict on the shipped reply.</param>
/// <param name="LeakCheck">The leak-check verdict on the shipped reply.</param>
/// <param name="Revisions">How many times the reply was regenerated because a guard flagged it
/// (0 when clean first try).</param>
/// <param name="Usage">The turn's total spend and token counts, summed over every model call it made.</param>
public record ExaminerTurnOutcome(
    string Reply,
    MathCheckResult MathCheck,
    LeakCheckResult LeakCheck,
    int Revisions,
    ModelUsage Usage);

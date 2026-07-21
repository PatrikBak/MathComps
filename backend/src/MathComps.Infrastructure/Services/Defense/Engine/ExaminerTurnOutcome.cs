using MathComps.Infrastructure.Services.Ai;
using MathComps.Infrastructure.Services.Defense.Dtos;

namespace MathComps.Infrastructure.Services.Defense.Engine;

/// <summary>
/// The result of one examiner turn: the reply that ships, the two guards' verdicts on it, how many times the reply
/// was regenerated, whether the shipped reply is the constrained fallback, and the turn's usage (the summed spend
/// and token counts of every model call it made: the first attempt, both guards, and every revision). The verdicts
/// are the ones on the shipped reply.
/// </summary>
/// <param name="Reply">The examiner's shipped reply.</param>
/// <param name="MathCheck">The math-check verdict on the shipped reply.</param>
/// <param name="LeakCheck">The leak-check verdict on the shipped reply.</param>
/// <param name="Revisions">How many times the reply was regenerated because a check flagged it, the fallback
/// generation included (0 when clean first try).</param>
/// <param name="SafeFallback">Whether the revision cap ran out with the reply still flagged, so the shipped reply is
/// the constrained fallback rather than a normal attempt.</param>
/// <param name="Usage">The turn's total spend and token counts, summed over every model call it made.</param>
public record ExaminerTurnOutcome(
    string Reply,
    MathCheckResult MathCheck,
    LeakCheckResult LeakCheck,
    int Revisions,
    bool SafeFallback,
    ModelUsage Usage);

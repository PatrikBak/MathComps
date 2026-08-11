using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Services.Ai;

namespace MathComps.Infrastructure.Services.Defense.Engine;

/// <summary>
/// One model call an attempt made, and what it billed. A turn sums its calls into a single figure for the spend
/// ceiling, which is the right shape for charging and the wrong one for tuning: it can't say what a guard costs, or
/// what moving its reasoning level would save. This is that breakdown.
/// </summary>
/// <param name="Step">The step this call ran.</param>
/// <param name="Model">The model it routed to.</param>
/// <param name="ReasoningEffort">The reasoning-effort level it ran at, or null when none was sent.</param>
/// <param name="Usage">What the call billed: its spend and token counts.</param>
/// <param name="DurationMs">How long the call took, in milliseconds, retries included.</param>
public record ExaminerStepCall(
    ExaminerStep Step, string Model, string? ReasoningEffort, ModelUsage Usage, int DurationMs);

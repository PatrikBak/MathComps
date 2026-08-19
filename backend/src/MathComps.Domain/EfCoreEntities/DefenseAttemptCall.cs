namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// One model call a <see cref="DefenseTurnAttempt"/> made, and what it billed. A turn's total is what the spend
/// ceiling charges against, and it can't answer what one step costs or what moving that step's reasoning level would
/// save; these rows can, since each names the step and the routing it ran under.
/// </summary>
/// <remarks>
/// This is diagnostics, not the money record: <see cref="DefenseSpend"/> remains the authoritative ledger and
/// survives a session's deletion, where these rows go with the conversation they describe.
/// </remarks>
public class DefenseAttemptCall
{
    /// <summary>
    /// Primary key (Guid v7).
    /// </summary>
    public Guid Id { get; set; } = Guid.CreateVersion7();

    /// <summary>
    /// The attempt that made the call.
    /// </summary>
    public required Guid AttemptId { get; set; }

    /// <summary>
    /// Navigation to the attempt.
    /// </summary>
    public DefenseTurnAttempt Attempt { get; set; } = null!;

    /// <summary>
    /// Which step made the call.
    /// </summary>
    public required ExaminerStep Step { get; set; }

    /// <summary>
    /// The model that answered it. A fallback chain can make that a different model from the one its step is
    /// configured for.
    /// </summary>
    public required string Model { get; set; }

    /// <summary>
    /// The reasoning-effort level it ran at, or null when none was sent.
    /// </summary>
    public required string? ReasoningEffort { get; set; }

    /// <summary>
    /// The call's billed cost in credits (one credit is one US dollar).
    /// </summary>
    public required decimal Cost { get; set; }

    /// <summary>
    /// The call's prompt (input) tokens.
    /// </summary>
    public required int PromptTokens { get; set; }

    /// <summary>
    /// The call's completion (output) tokens, the reasoning ones counted among them.
    /// </summary>
    public required int CompletionTokens { get; set; }

    /// <summary>
    /// The call's reasoning (thinking) tokens, already counted within <see cref="CompletionTokens"/>.
    /// </summary>
    public required int ReasoningTokens { get; set; }

    /// <summary>
    /// The call's prompt tokens served from the provider's cache, a subset of <see cref="PromptTokens"/>.
    /// </summary>
    public required int CachedPromptTokens { get; set; }

    /// <summary>
    /// How long the call took, in milliseconds, the retries behind it included. 0 on a call recorded before the
    /// timings were kept.
    /// </summary>
    public required int DurationMs { get; set; }
}

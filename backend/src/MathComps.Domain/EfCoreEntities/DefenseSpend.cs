namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// One examiner turn's billed spend, recorded per user for the cost caps. Append-only and independent of
/// <see cref="DefenseSession"/> (no foreign key), so deleting a session leaves this record intact: it is a spend fact,
/// not conversation content, and un-evadable by deleting sessions. Summed over a rolling window it enforces a
/// per-user ceiling.
/// </summary>
public class DefenseSpend
{
    /// <summary>
    /// Primary key (Guid v7).
    /// </summary>
    public Guid Id { get; set; } = Guid.CreateVersion7();

    /// <summary>
    /// The user who incurred the spend.
    /// </summary>
    public required Guid UserId { get; set; }

    /// <summary>
    /// The turn's total billed cost in credits (one credit is one US dollar).
    /// </summary>
    public required decimal Cost { get; set; }

    /// <summary>
    /// The turn's total prompt (input) tokens.
    /// </summary>
    public required int PromptTokens { get; set; }

    /// <summary>
    /// The turn's total completion (output) tokens, the reasoning ones counted among them.
    /// </summary>
    public required int CompletionTokens { get; set; }

    /// <summary>
    /// The turn's reasoning (thinking) tokens, already counted within <see cref="CompletionTokens"/> and billed at
    /// the output rate; 0 when the model reports none.
    /// </summary>
    public required int ReasoningTokens { get; set; }

    /// <summary>
    /// The turn's prompt tokens served from the provider's cache at a reduced rate, a subset of
    /// <see cref="PromptTokens"/>; 0 when the model reports none.
    /// </summary>
    public required int CachedPromptTokens { get; set; }

    /// <summary>
    /// How long the turn's engine run took, in milliseconds.
    /// </summary>
    public required int DurationMs { get; set; }

    /// <summary>
    /// How many times the turn's reply was regenerated because a guard flagged it (0 when clean first try).
    /// </summary>
    public required int Revisions { get; set; }

    /// <summary>
    /// When the spend was incurred.
    /// </summary>
    public required DateTimeOffset CreatedAt { get; set; }
}

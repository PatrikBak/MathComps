namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// The billed spend of one examiner turn or one photo reading, recorded per user for the cost caps. Append-only and
/// independent of <see cref="DefenseSession"/> (no foreign key), so deleting a session leaves this record intact: it
/// is a spend fact, not conversation content, and un-evadable by deleting sessions. A reading's row names its photo
/// the same way, by id alone. The rows <see cref="CountsAgainstCeiling"/> marks, summed since UTC midnight, enforce a
/// per-user daily ceiling.
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
    /// The total billed cost in credits (one credit is one US dollar).
    /// </summary>
    public required decimal Cost { get; set; }

    /// <summary>
    /// The total prompt (input) tokens.
    /// </summary>
    public required int PromptTokens { get; set; }

    /// <summary>
    /// The total completion (output) tokens, the reasoning ones counted among them.
    /// </summary>
    public required int CompletionTokens { get; set; }

    /// <summary>
    /// The reasoning (thinking) tokens, already counted within <see cref="CompletionTokens"/> and billed at
    /// the output rate; 0 when the model reports none.
    /// </summary>
    public required int ReasoningTokens { get; set; }

    /// <summary>
    /// The prompt tokens served from the provider's cache at a reduced rate, a subset of
    /// <see cref="PromptTokens"/>; 0 when the model reports none.
    /// </summary>
    public required int CachedPromptTokens { get; set; }

    /// <summary>
    /// How long the work took, in milliseconds: a turn's engine run, or a photo's reading.
    /// </summary>
    public required int DurationMs { get; set; }

    /// <summary>
    /// How many times a turn's reply was regenerated because a guard flagged it; 0 when it was clean the first time,
    /// and for a photo reading.
    /// </summary>
    public required int Revisions { get; set; }

    /// <summary>
    /// Whether this spend is weighed against the user's daily ceiling. False for a defense of a problem whose
    /// round the student holds an entry into: the ceiling is there so handout practice cannot run away, and an
    /// entered competition's turns and readings would spend the very allowance the practice is held to.
    /// </summary>
    public required bool CountsAgainstCeiling { get; set; }

    /// <summary>
    /// The <see cref="DefensePhoto"/> a photo reading read; null for an examiner turn.
    /// </summary>
    public required Guid? PhotoId { get; set; }

    /// <summary>
    /// When the spend was incurred.
    /// </summary>
    public required DateTimeOffset CreatedAt { get; set; }
}

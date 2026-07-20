namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// One turn of a <see cref="DefenseSession"/>: who spoke and what they said. Content only — a turn carries no cost or
/// telemetry (that lives in the independent <see cref="DefenseSpend"/> ledger, so it survives a session's deletion).
/// </summary>
public class DefenseTurn
{
    /// <summary>
    /// Primary key (Guid v7).
    /// </summary>
    public Guid Id { get; set; } = Guid.CreateVersion7();

    /// <summary>
    /// The session this turn belongs to.
    /// </summary>
    public required Guid SessionId { get; set; }

    /// <summary>
    /// Navigation to the session.
    /// </summary>
    public DefenseSession Session { get; set; } = null!;

    /// <summary>
    /// Who authored the turn.
    /// </summary>
    public required TranscriptRole Role { get; set; }

    /// <summary>
    /// The turn's text (markdown).
    /// </summary>
    public required string Content { get; set; }

    /// <summary>
    /// The turn's position in the conversation, 0-based, giving a deterministic order.
    /// </summary>
    public required int Sequence { get; set; }

    /// <summary>
    /// When the turn was recorded.
    /// </summary>
    public required DateTimeOffset CreatedAt { get; set; }
}

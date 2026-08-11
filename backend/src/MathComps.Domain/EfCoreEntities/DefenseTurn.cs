namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// One turn of a <see cref="DefenseSession"/>: who spoke and what they said, plus the drafts an examiner turn went
/// through to get there. A turn carries no cost of its own — that lives in the independent <see cref="DefenseSpend"/>
/// ledger, so it survives a session's deletion, where the drafts are content and go with it.
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
    /// Every reply the examiner drafted on its way to this turn; empty on a candidate's turn, and on an examiner turn
    /// recorded before the drafts were kept.
    /// </summary>
    public List<DefenseTurnAttempt> Attempts { get; set; } = [];

    /// <summary>
    /// When the turn was recorded.
    /// </summary>
    public required DateTimeOffset CreatedAt { get; set; }
}

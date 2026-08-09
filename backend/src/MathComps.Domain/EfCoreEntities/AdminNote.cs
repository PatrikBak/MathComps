namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// Something written down about a <see cref="DefenseSession"/> while reviewing it, against one reply or against the
/// whole conversation. Unlike a <see cref="DefenseTurnReport"/>, which is the student's own verdict and at most one
/// per reply, notes accumulate: a reply can be wrong in several ways and each gets said separately.
/// </summary>
/// <remarks>
/// Notes are the record a later pass reads to find what keeps going wrong, which is why <see cref="Category"/>
/// files them on the same axis a student's report uses and <see cref="ResolvedAt"/> separates what still stands
/// from what a since-shipped fix already covers.
/// </remarks>
public class AdminNote
{
    /// <summary>
    /// Primary key (Guid v7).
    /// </summary>
    public Guid Id { get; set; } = Guid.CreateVersion7();

    /// <summary>
    /// The reviewer who wrote it, as against the student whose conversation it is about.
    /// </summary>
    public required Guid AuthorId { get; set; }

    /// <summary>
    /// Navigation to the author.
    /// </summary>
    public User Author { get; set; } = null!;

    /// <summary>
    /// The reviewed conversation.
    /// </summary>
    public required Guid SessionId { get; set; }

    /// <summary>
    /// Navigation to the conversation.
    /// </summary>
    public DefenseSession Session { get; set; } = null!;

    /// <summary>
    /// The reply the note is against, or null when it is against the conversation as a whole.
    /// </summary>
    public required Guid? TurnId { get; set; }

    /// <summary>
    /// Navigation to that reply, null alongside <see cref="TurnId"/>.
    /// </summary>
    public DefenseTurn? Turn { get; set; }

    /// <summary>
    /// The note itself, as markdown.
    /// </summary>
    public required string Content { get; set; }

    /// <summary>
    /// Which failure the note names, or null when it names none.
    /// </summary>
    public required DefenseReportCategory? Category { get; set; }

    /// <summary>
    /// When the note was settled, or null while it still stands. A settled note stays where it is and keeps its
    /// example intact; only what counts as an open problem changes.
    /// </summary>
    public required DateTimeOffset? ResolvedAt { get; set; }

    /// <summary>
    /// When the note was written.
    /// </summary>
    public required DateTimeOffset CreatedAt { get; set; }

    /// <summary>
    /// When the note last changed, equal to <see cref="CreatedAt"/> until it is revised.
    /// </summary>
    public required DateTimeOffset UpdatedAt { get; set; }
}

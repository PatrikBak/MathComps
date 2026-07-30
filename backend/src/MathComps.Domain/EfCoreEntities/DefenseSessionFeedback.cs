namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// What a student said about one whole <see cref="DefenseSession"/>: where it left them, and whatever they wanted
/// to add in their own words. At most one per session, revised rather than accumulated when they answer again, so
/// it always reads as their current verdict on the conversation.
/// </summary>
/// <remarks>
/// Distinct in kind from a <see cref="DefenseTurnReport"/>, which reports a fault: this records where the
/// conversation got the student, whether or not anything went wrong, and so is the only feedback a defense that
/// worked leaves.
/// </remarks>
public class DefenseSessionFeedback
{
    /// <summary>
    /// The session this answers for; also this row's primary key, since a session has at most one answer.
    /// </summary>
    public required Guid SessionId { get; set; }

    /// <summary>
    /// Navigation to the session.
    /// </summary>
    public DefenseSession Session { get; set; } = null!;

    /// <summary>
    /// What the examiner did for the student.
    /// </summary>
    public required DefenseOutcome Outcome { get; set; }

    /// <summary>
    /// What the student said in their own words, or null when they let the outcome stand alone. Required
    /// alongside <see cref="DefenseOutcome.SomethingElse"/>, which says nothing on its own.
    /// </summary>
    public required string? Comment { get; set; }

    /// <summary>
    /// When the student first answered.
    /// </summary>
    public required DateTimeOffset CreatedAt { get; set; }

    /// <summary>
    /// When the answer last changed, equal to <see cref="CreatedAt"/> until the student revises it.
    /// </summary>
    public required DateTimeOffset UpdatedAt { get; set; }
}

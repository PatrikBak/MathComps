namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// A student's report that one examiner reply in a <see cref="DefenseSession"/> went wrong, naming every way it
/// did. At most one per reply, revised rather than accumulated when the student reports it again, so it always
/// reads as what they currently hold against it.
/// </summary>
/// <remarks>
/// A report lives exactly as long as the reply it is against: rewinding past that reply takes the report with it,
/// as does deleting the whole conversation. What is held against a reply is only worth anything beside the reply
/// itself, and a student who drops a reply has dropped what was said about it too.
/// </remarks>
public class DefenseTurnReport
{
    /// <summary>
    /// Primary key (Guid v7).
    /// </summary>
    public Guid Id { get; set; } = Guid.CreateVersion7();

    /// <summary>
    /// The session the reported reply was given in, which is what a conversation's reports are read from and
    /// what holds the reply to being one of that conversation's own.
    /// </summary>
    public required Guid SessionId { get; set; }

    /// <summary>
    /// Navigation to the session.
    /// </summary>
    public DefenseSession Session { get; set; } = null!;

    /// <summary>
    /// The reported reply.
    /// </summary>
    public required Guid TurnId { get; set; }

    /// <summary>
    /// Navigation to the reported reply.
    /// </summary>
    public DefenseTurn Turn { get; set; } = null!;

    /// <summary>
    /// Every way the reply went wrong.
    /// </summary>
    public required List<DefenseReportCategory> Categories { get; set; }

    /// <summary>
    /// The student's own account of what went wrong, or null when they gave none.
    /// </summary>
    public required string? Comment { get; set; }

    /// <summary>
    /// When the reply was first reported.
    /// </summary>
    public required DateTimeOffset CreatedAt { get; set; }

    /// <summary>
    /// When the report last changed, equal to <see cref="CreatedAt"/> until the student revises it.
    /// </summary>
    public required DateTimeOffset UpdatedAt { get; set; }
}

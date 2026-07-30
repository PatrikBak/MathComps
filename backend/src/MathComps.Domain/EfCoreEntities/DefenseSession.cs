namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// One user's defense conversation about one problem: the student argues a solution and the AI examiner probes it,
/// turn by turn. Holds the problem statement and its reference solution so a follow-up turn can re-run the examiner
/// without the client resending them. Deleting a session removes it, its turns, and everything the student said
/// about it outright (the spend record in <see cref="DefenseSpend"/> is independent and survives).
/// </summary>
public class DefenseSession
{
    /// <summary>
    /// Primary key (Guid v7).
    /// </summary>
    public Guid Id { get; set; } = Guid.CreateVersion7();

    /// <summary>
    /// The user defending the solution.
    /// </summary>
    public required Guid UserId { get; set; }

    /// <summary>
    /// Navigation to the user.
    /// </summary>
    public User User { get; set; } = null!;

    /// <summary>
    /// Which handout environment this session defends. Null when no environment is linked to this session.
    /// </summary>
    public HandoutEnvironmentDefense? EnvironmentTarget { get; set; }

    /// <summary>
    /// What the student said about the conversation. Null until they say anything.
    /// </summary>
    public DefenseSessionFeedback? Feedback { get; set; }

    /// <summary>
    /// The problem statement, seen by both sides.
    /// </summary>
    /// <remarks>
    /// This and <see cref="ProblemReference"/> are snapshotted onto the session at creation, not looked up,
    /// so the conversation stays coherent if the source content is later edited (and so handout problems,
    /// which have no database row, work at all).
    /// </remarks>
    public required string ProblemStatement { get; set; }

    /// <summary>
    /// The reference solution the examiner reasons from.
    /// </summary>
    public required string ProblemReference { get; set; }

    /// <summary>
    /// A snapshot of the examiner settings the conversation ran under (models, reasoning efforts, token caps,
    /// revision cap), as JSON. Makes each conversation self-describing so a later config change can't silently
    /// re-interpret what an old session's spend meant. Deliberately a decoupled archival blob, not a typed
    /// converter: it is write-once and never deserialized, so typing it would only add read-time fragility as the
    /// settings shape drifts.
    /// </summary>
    public required string ExaminerConfig { get; set; }

    /// <summary>
    /// When the session was started.
    /// </summary>
    public required DateTimeOffset CreatedAt { get; set; }

    /// <summary>
    /// The conversation's turns, in order.
    /// </summary>
    public ICollection<DefenseTurn> Turns { get; } = [];

    /// <summary>
    /// What the student holds against the conversation's replies, one entry per reported reply.
    /// </summary>
    public ICollection<DefenseTurnReport> Reports { get; } = [];
}

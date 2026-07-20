namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// One user's defense conversation about one problem: the student argues a solution and the AI examiner probes it,
/// turn by turn. Holds the problem statement and its reference solution so a follow-up turn can re-run the examiner
/// without the client resending them. Deleting a session removes it and its turns outright (the spend record in
/// <see cref="DefenseSpend"/> is independent and survives).
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
    /// Stable, source-namespaced key of the problem being defended (e.g. <c>handout:...</c>), grouping a
    /// user's sessions on it. A correlation token, not a foreign key: some sources (handout problems) live
    /// outside the database, so identity can't be a problem-row reference.
    /// </summary>
    public required string ProblemKey { get; set; }

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
    /// When the session was started.
    /// </summary>
    public required DateTimeOffset CreatedAt { get; set; }

    /// <summary>
    /// The conversation's turns, in order.
    /// </summary>
    public ICollection<DefenseTurn> Turns { get; } = [];
}

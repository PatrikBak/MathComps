namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// Join row linking a defense session to the archive problem it defends. Present only on a session whose
/// <see cref="DefenseSession.TargetKind"/> is <see cref="DefenseTargetKind.Problem"/>.
/// </summary>
/// <remarks>
/// It names the problem and nothing about the sitting it was argued in. For a problem of a hosted competition
/// that means the entry is not on the row: every conversation a student has held about the problem reads back
/// the same way, whichever entry was open at the time, and which entry a turn counted in is arithmetic over its
/// stamp against that entry's window. One rule covers re-entry and covers a turn sent after the clock ran out.
/// </remarks>
public class ProblemDefense
{
    /// <summary>
    /// FK to the defense session; also this row's primary key, since a session defends at most one problem.
    /// </summary>
    public required Guid DefenseSessionId { get; set; }

    /// <summary>
    /// Navigation to the defense session.
    /// </summary>
    public DefenseSession DefenseSession { get; set; } = null!;

    /// <summary>
    /// The kind of target this row is, fixed to <see cref="DefenseTargetKind.Problem"/> by a check constraint
    /// and part of the key it points at the session by.
    /// </summary>
    public DefenseTargetKind TargetKind { get; } = DefenseTargetKind.Problem;

    /// <summary>
    /// FK to the problem being defended.
    /// </summary>
    public required Guid ProblemId { get; set; }

    /// <summary>
    /// Navigation to the problem.
    /// </summary>
    public Problem Problem { get; set; } = null!;
}

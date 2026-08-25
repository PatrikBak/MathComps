namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// Join row linking a defense session to the handout environment it defends. Present only on a session whose
/// <see cref="DefenseSession.TargetKind"/> is <see cref="DefenseTargetKind.Handout"/>.
/// </summary>
public class HandoutEnvironmentDefense
{
    /// <summary>
    /// FK to the defense session; also this row's primary key, since a session defends at most one environment.
    /// </summary>
    public required Guid DefenseSessionId { get; set; }

    /// <summary>
    /// Navigation to the defense session.
    /// </summary>
    public DefenseSession DefenseSession { get; set; } = null!;

    /// <summary>
    /// The kind of target this row is, fixed to <see cref="DefenseTargetKind.Handout"/> by a check constraint
    /// and part of the key it points at the session by.
    /// </summary>
    public DefenseTargetKind TargetKind { get; } = DefenseTargetKind.Handout;

    /// <summary>
    /// FK to the environment.
    /// </summary>
    public required Guid HandoutEnvironmentId { get; set; }

    /// <summary>
    /// Navigation to the environment.
    /// </summary>
    public HandoutEnvironment HandoutEnvironment { get; set; } = null!;
}

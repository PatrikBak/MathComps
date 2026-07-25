namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// Join row linking a defense session to the handout environment it defends. Each defense session has exactly one.
/// </summary>
public class HandoutEnvironmentDefense
{
    /// <summary>
    /// FK to the defense session; also this row's primary key, since a session defends exactly one environment.
    /// </summary>
    public required Guid DefenseSessionId { get; set; }

    /// <summary>
    /// Navigation to the defense session.
    /// </summary>
    public DefenseSession DefenseSession { get; set; } = null!;

    /// <summary>
    /// FK to the environment.
    /// </summary>
    public required Guid HandoutEnvironmentId { get; set; }

    /// <summary>
    /// Navigation to the environment.
    /// </summary>
    public HandoutEnvironment HandoutEnvironment { get; set; } = null!;
}

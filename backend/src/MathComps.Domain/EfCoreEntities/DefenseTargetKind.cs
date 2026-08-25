namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// Which kind of thing a defense session defends. Stored on the session so the database can hold a session to
/// exactly one target: each target table carries this value too, pinned to its own kind, and points at the
/// session through it.
/// </summary>
public enum DefenseTargetKind
{
    /// <summary>
    /// A handout environment.
    /// </summary>
    Handout = 0,

    /// <summary>
    /// An archive problem.
    /// </summary>
    Problem = 1,
}

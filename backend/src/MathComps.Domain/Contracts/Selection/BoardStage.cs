namespace MathComps.Domain.Contracts.Selection;

/// <summary>
/// Where a board stands against the cycle it picks papers for.
/// </summary>
public enum BoardStage
{
    /// <summary>
    /// A draft that can be finalized into the cycle: the cycle is still to open, its rounds are empty, and the
    /// papers pair with them by level and size. Whether every slot holds a problem is checked only when it is
    /// finalized.
    /// </summary>
    Finalizable,

    /// <summary>
    /// A draft that can't be finalized into the cycle: the cycle has opened, a round already holds problems, or the
    /// papers don't pair with its rounds. It still takes changes.
    /// </summary>
    Unfinalizable,

    /// <summary>
    /// Finalized into the cycle, which is still to open.
    /// </summary>
    Finalized,

    /// <summary>
    /// Finalized into the cycle, which has opened to students.
    /// </summary>
    Opened,
}

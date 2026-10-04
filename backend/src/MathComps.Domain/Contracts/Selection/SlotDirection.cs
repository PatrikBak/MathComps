namespace MathComps.Domain.Contracts.Selection;

/// <summary>
/// Which neighbour a slot trades with when it moves within its paper.
/// </summary>
public enum SlotDirection
{
    /// <summary>
    /// The slot above, one position earlier.
    /// </summary>
    Up,

    /// <summary>
    /// The slot below, one position later.
    /// </summary>
    Down,
}

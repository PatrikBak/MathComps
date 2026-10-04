namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// One filled slot of a draft paper: the proposal standing in it. An empty slot has no row.
/// </summary>
/// <remarks>
/// Only a draft keeps these, so finalizing a board removes its rows. A slot only ever holds a live proposal still
/// in the pool: deleting a proposal, and every write that takes a problem out of the pool, empties its slots.
/// </remarks>
public class SelectionSlot
{
    /// <summary>
    /// FK to the paper holding the slot.
    /// </summary>
    public required Guid PaperId { get; set; }

    /// <summary>
    /// Navigation to the paper.
    /// </summary>
    public SelectionPaper Paper { get; set; } = null!;

    /// <summary>
    /// The slot's position in its paper, from zero.
    /// </summary>
    public required int Position { get; set; }

    /// <summary>
    /// FK to the proposal standing in the slot, which is its problem's id.
    /// </summary>
    public required Guid ProblemId { get; set; }

    /// <summary>
    /// Navigation to the proposal.
    /// </summary>
    public Proposal Proposal { get; set; } = null!;
}

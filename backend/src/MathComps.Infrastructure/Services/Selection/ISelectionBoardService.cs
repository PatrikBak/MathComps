using MathComps.Domain.Contracts.Selection;
using MathComps.Infrastructure.Services.Problems;

namespace MathComps.Infrastructure.Services.Selection;

/// <summary>
/// Fills the boards' slots from the pool, and finalizes a board into the rounds of a hosted group. A draft board is
/// the selection's own; a finalized one is its group's rounds, so every change to it moves real problems, and it
/// accepts no change once the group opens. Every change runs after every one before it has finished.
/// </summary>
public interface ISelectionBoardService
{
    /// <summary>
    /// Puts a proposal into a slot. On a draft, a proposal already elsewhere on the board trades places with
    /// whatever held the slot, and one from the pool sends that problem back to it. On a finalized board the
    /// proposal takes the slot's round and number, and the problem there takes the proposal's place, so every
    /// round keeps its count; a proposal coming from the pool leaves every draft it stood on.
    /// </summary>
    /// <param name="slot">The slot the proposal goes into.</param>
    /// <param name="proposalId">The proposal.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>A task that completes once the change is saved.</returns>
    /// <exception cref="SelectionTargetNotFoundException">
    /// Thrown when the slot or a live proposal is not there.
    /// </exception>
    /// <exception cref="SelectionBoardOpenedException">Thrown when the board's group has opened.</exception>
    /// <exception cref="SelectionProposalUsedException">
    /// Thrown when a paper outside this board has taken the proposal.
    /// </exception>
    /// <exception cref="SelectionProblemIncompleteException">
    /// Thrown when a proposal entering a finalized board's round is not written in every language.
    /// </exception>
    /// <exception cref="ProblemSlugTakenException">
    /// Thrown on a finalized board when a problem outside the trade carries a slug it would write.
    /// </exception>
    Task PlaceAsync(SlotAddress slot, Guid proposalId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Empties a draft's slot, sending its problem back to the pool.
    /// </summary>
    /// <param name="slot">The slot.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>A task that completes once the change is saved.</returns>
    /// <exception cref="SelectionTargetNotFoundException">Thrown when the slot is not there.</exception>
    /// <exception cref="SelectionBoardOpenedException">Thrown when the board's group has opened.</exception>
    /// <exception cref="SelectionPaperFinalizedException">
    /// Thrown when the board is finalized, since a round never stands part-filled.
    /// </exception>
    Task ClearSlotAsync(SlotAddress slot, CancellationToken cancellationToken = default);

    /// <summary>
    /// Trades a slot with its neighbour in the same paper.
    /// </summary>
    /// <param name="slot">The slot.</param>
    /// <param name="direction"><inheritdoc cref="SlotDirection" path="/summary"/></param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>A task that completes once the change is saved.</returns>
    /// <exception cref="SelectionTargetNotFoundException">Thrown when either slot is not there.</exception>
    /// <exception cref="SelectionBoardOpenedException">Thrown when the board's group has opened.</exception>
    /// <exception cref="ProblemSlugTakenException">
    /// Thrown on a finalized board when a problem outside the trade carries a slug it would write.
    /// </exception>
    Task MoveSlotAsync(SlotAddress slot, SlotDirection direction, CancellationToken cancellationToken = default);

    /// <summary>
    /// Finalizes a draft board into a hosted group: each paper's problems move into the round of the paper's
    /// category, in slot order, and leave every other draft they stood on. The board then reads its slots off the
    /// rounds.
    /// </summary>
    /// <param name="boardId">The board.</param>
    /// <param name="cycleId">The hosted group whose rounds take the papers.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>A task that completes once the problems have moved.</returns>
    /// <exception cref="SelectionTargetNotFoundException">Thrown when the board or the group is not there.</exception>
    /// <exception cref="SelectionBoardOpenedException">Thrown when the board's group has opened.</exception>
    /// <exception cref="SelectionBoardFinalizedException">Thrown when the board is already finalized.</exception>
    /// <exception cref="SelectionFinalizeBlockedException">
    /// Thrown when the board cannot be finalized into the group.
    /// </exception>
    /// <exception cref="SelectionProposalUsedException">
    /// Thrown when a paper outside this board has taken a slotted problem.
    /// </exception>
    /// <exception cref="SelectionProblemIncompleteException">
    /// Thrown when a slotted problem is not written in every language.
    /// </exception>
    /// <exception cref="ProblemSlugTakenException">
    /// Thrown when a problem outside the board carries a slug a slotted problem would take.
    /// </exception>
    Task FinalizeAsync(Guid boardId, Guid cycleId, CancellationToken cancellationToken = default);
}

/// <summary>
/// Thrown when a board is changed after the group it was finalized into has opened.
/// </summary>
public sealed class SelectionBoardOpenedException() : Exception("This board's competitions have opened");

/// <summary>
/// Thrown when a finalized paper is asked to stand part-filled.
/// </summary>
public sealed class SelectionPaperFinalizedException() : Exception("This paper is finalized");

/// <summary>
/// Thrown when a board already finalized into a group is finalized again.
/// </summary>
public sealed class SelectionBoardFinalizedException() : Exception("This board is already finalized");

/// <summary>
/// Thrown when a problem would enter a hosted round without a statement and a solution in every language.
/// </summary>
public sealed class SelectionProblemIncompleteException()
    : Exception("A problem going into a round lacks a statement or a solution in some language");

/// <summary>
/// Thrown when a board cannot be finalized into a group: the group no longer takes one, the papers don't pair up
/// with its rounds by category and size, or a slot stands empty.
/// </summary>
public sealed class SelectionFinalizeBlockedException() : Exception("This board cannot be finalized into that cycle");

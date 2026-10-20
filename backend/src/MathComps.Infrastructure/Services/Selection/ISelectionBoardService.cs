using MathComps.Domain.Contracts.Selection;
using MathComps.Domain.EfCoreEntities;

namespace MathComps.Infrastructure.Services.Selection;

/// <summary>
/// Fills a draft board's slots from its organization's pool. A finalized board is its group's rounds, which every
/// change here refuses to touch. Every change runs after every one before it has finished.
/// </summary>
public interface ISelectionBoardService
{
    /// <summary>
    /// Puts a proposal into a draft's slot. A proposal already elsewhere on the board trades places with whatever
    /// held the slot, and one from the pool sends that problem back to it.
    /// </summary>
    /// <param name="organizationSlug">
    /// The <see cref="Organization.Slug"/> of the organization whose selection the board is in.
    /// </param>
    /// <param name="slot">The slot the proposal goes into.</param>
    /// <param name="proposalId">The proposal, which has to be in the organization's pool.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>A task that completes once the change is saved.</returns>
    /// <exception cref="SelectionTargetNotFoundException">
    /// Thrown when the slot or a live proposal of the organization's pool is not there.
    /// </exception>
    /// <exception cref="SelectionBoardOpenedException">Thrown when the board's group has opened.</exception>
    /// <exception cref="SelectionBoardFinalizedException">Thrown when the board is finalized.</exception>
    /// <exception cref="SelectionProposalUsedException">Thrown when a paper has taken the proposal.</exception>
    Task PlaceAsync(
        string organizationSlug, SlotAddress slot, Guid proposalId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Empties a draft's slot, sending its problem back to the pool.
    /// </summary>
    /// <param name="organizationSlug">
    /// The <see cref="Organization.Slug"/> of the organization whose selection the board is in.
    /// </param>
    /// <param name="slot">The slot.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>A task that completes once the change is saved.</returns>
    /// <exception cref="SelectionTargetNotFoundException">Thrown when the slot is not there.</exception>
    /// <exception cref="SelectionBoardOpenedException">Thrown when the board's group has opened.</exception>
    /// <exception cref="SelectionBoardFinalizedException">Thrown when the board is finalized.</exception>
    Task ClearSlotAsync(string organizationSlug, SlotAddress slot, CancellationToken cancellationToken = default);

    /// <summary>
    /// Trades a draft's slot with its neighbour in the same paper.
    /// </summary>
    /// <param name="organizationSlug">
    /// The <see cref="Organization.Slug"/> of the organization whose selection the board is in.
    /// </param>
    /// <param name="slot">The slot.</param>
    /// <param name="direction"><inheritdoc cref="SlotDirection" path="/summary"/></param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>A task that completes once the change is saved.</returns>
    /// <exception cref="SelectionTargetNotFoundException">Thrown when either slot is not there.</exception>
    /// <exception cref="SelectionBoardOpenedException">Thrown when the board's group has opened.</exception>
    /// <exception cref="SelectionBoardFinalizedException">Thrown when the board is finalized.</exception>
    Task MoveSlotAsync(
        string organizationSlug, SlotAddress slot, SlotDirection direction,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// Thrown when a board is changed after the group it was finalized into has opened.
/// </summary>
public sealed class SelectionBoardOpenedException() : Exception("This board's competitions have opened");

/// <summary>
/// Thrown when a board already finalized into a group is changed, or finalized again.
/// </summary>
public sealed class SelectionBoardFinalizedException() : Exception("This board is already finalized");

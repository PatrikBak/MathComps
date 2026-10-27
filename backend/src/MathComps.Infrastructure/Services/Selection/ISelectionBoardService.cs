using MathComps.Domain.Contracts.Selection;
using MathComps.Domain.EfCoreEntities;
using Microsoft.Extensions.Logging;

namespace MathComps.Infrastructure.Services.Selection;

/// <summary>
/// Fills a draft board's slots from its organization's pool. A finalized board is its group's rounds, which every
/// change here refuses to touch. Only the leads of a paper's category make these changes to it. Every change runs
/// after every one before it has finished.
/// </summary>
public interface ISelectionBoardService
{
    /// <summary>
    /// Puts a proposal into a draft's slot. A proposal already elsewhere on the board trades places with whatever
    /// held the slot, so the paper it leaves changes too. One from the pool sends that problem back to the pool.
    /// </summary>
    /// <param name="organizationSlug">
    /// The <see cref="Organization.Slug"/> of the organization whose selection the board is in.
    /// </param>
    /// <param name="userId">
    /// The account making the change, which has to lead the category of every paper the change touches.
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
    /// <exception cref="SelectionNotLeadException">
    /// Thrown when the account does not lead the category of a paper the change touches.
    /// </exception>
    Task PlaceAsync(
        string organizationSlug, Guid userId, SlotAddress slot, Guid proposalId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Empties a draft's slot, sending its problem back to the pool.
    /// </summary>
    /// <param name="organizationSlug">
    /// The <see cref="Organization.Slug"/> of the organization whose selection the board is in.
    /// </param>
    /// <param name="userId">The account making the change, which has to lead the category of the slot's paper.</param>
    /// <param name="slot">The slot.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>A task that completes once the change is saved.</returns>
    /// <exception cref="SelectionTargetNotFoundException">Thrown when the slot is not there.</exception>
    /// <exception cref="SelectionBoardOpenedException">Thrown when the board's group has opened.</exception>
    /// <exception cref="SelectionBoardFinalizedException">Thrown when the board is finalized.</exception>
    /// <exception cref="SelectionNotLeadException">
    /// Thrown when the account does not lead the category of a paper the change touches.
    /// </exception>
    Task ClearSlotAsync(
        string organizationSlug, Guid userId, SlotAddress slot, CancellationToken cancellationToken = default);

    /// <summary>
    /// Trades a draft's slot with its neighbour in the same paper.
    /// </summary>
    /// <param name="organizationSlug">
    /// The <see cref="Organization.Slug"/> of the organization whose selection the board is in.
    /// </param>
    /// <param name="userId">The account making the change, which has to lead the category of the slot's paper.</param>
    /// <param name="slot">The slot.</param>
    /// <param name="direction"><inheritdoc cref="SlotDirection" path="/summary"/></param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>A task that completes once the change is saved.</returns>
    /// <exception cref="SelectionTargetNotFoundException">Thrown when either slot is not there.</exception>
    /// <exception cref="SelectionBoardOpenedException">Thrown when the board's group has opened.</exception>
    /// <exception cref="SelectionBoardFinalizedException">Thrown when the board is finalized.</exception>
    /// <exception cref="SelectionNotLeadException">
    /// Thrown when the account does not lead the category of a paper the change touches.
    /// </exception>
    Task MoveSlotAsync(
        string organizationSlug, Guid userId, SlotAddress slot, SlotDirection direction,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// Thrown when a board is changed after the group it was finalized into has opened.
/// </summary>
public sealed class SelectionBoardOpenedException()
    : MathCompsException(
        "This board's competitions have opened",
        RefusalKind.Conflict,
        LogLevel.Information);

/// <summary>
/// Thrown when a board already finalized into a group is changed, or finalized again.
/// </summary>
public sealed class SelectionBoardFinalizedException()
    : MathCompsException(
        "This board is already finalized",
        RefusalKind.Conflict,
        LogLevel.Information);

/// <summary>
/// Thrown when a paper's slots are changed by an account that does not lead the paper's category.
/// </summary>
public sealed class SelectionNotLeadException()
    : MathCompsException(
        "Only the leads of this paper's category change it",
        RefusalKind.Forbidden,
        LogLevel.Information);

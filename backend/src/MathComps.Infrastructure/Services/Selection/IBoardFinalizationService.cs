using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Services.Problems;

namespace MathComps.Infrastructure.Services.Selection;

/// <summary>
/// Finalizes the boards of the organization <see cref="Organization.MathCompsSlug"/> names into the rounds of the
/// hosted groups, which are its competitions. Every finalize runs after every selection write before it has finished.
/// </summary>
public interface IBoardFinalizationService
{
    /// <summary>
    /// Finalizes a draft board into a hosted group: each paper's problems move into the round of the hosted level the
    /// paper's category is, in slot order, and leave every other draft they stood on. The board then reads its slots
    /// off the rounds.
    /// </summary>
    /// <param name="organizationSlug">
    /// The <see cref="Organization.Slug"/> of the organization whose selection the board is in.
    /// </param>
    /// <param name="boardId">The board.</param>
    /// <param name="cycleId">The hosted group whose rounds take the papers.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>A task that completes once the problems have moved.</returns>
    /// <exception cref="SelectionTargetNotFoundException">
    /// Thrown when the organization is not the one <see cref="Organization.MathCompsSlug"/> names, the board is not
    /// one of its boards, or the group is not there.
    /// </exception>
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
    Task FinalizeAsync(
        string organizationSlug, Guid boardId, Guid cycleId, CancellationToken cancellationToken = default);
}

/// <summary>
/// Thrown when a problem would enter a hosted round without a statement and a solution in every language.
/// </summary>
public sealed class SelectionProblemIncompleteException()
    : Exception("A problem going into a round lacks a statement or a solution in some language");

/// <summary>
/// Thrown when a board cannot be finalized into a group: the group no longer takes one, the papers don't pair up
/// with its rounds by their categories' hosted levels and by size, or a slot stands empty.
/// </summary>
public sealed class SelectionFinalizeBlockedException() : Exception("This board cannot be finalized into that cycle");

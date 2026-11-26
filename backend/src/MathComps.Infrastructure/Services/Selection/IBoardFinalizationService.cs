using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Services.Problems;
using Microsoft.Extensions.Logging;

namespace MathComps.Infrastructure.Services.Selection;

/// <summary>
/// Finalizes selection boards into the rounds of the hosted groups they pick for. Every finalize runs after every
/// selection write before it has finished.
/// </summary>
public interface IBoardFinalizationService
{
    /// <summary>
    /// Finalizes a draft board into the hosted group it picks for: each paper's problems move into the round of the
    /// hosted level the paper's category is, in slot order, and leave every other draft they stood on. The board
    /// then reads its slots off the rounds.
    /// </summary>
    /// <param name="organizationSlug">
    /// The <see cref="Organization.Slug"/> of the organization whose selection the board is in.
    /// </param>
    /// <param name="boardId">The board.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>A task that completes once the problems have moved.</returns>
    /// <exception cref="SelectionTargetNotFoundException">
    /// Thrown when the board is not one of the organization's boards.
    /// </exception>
    /// <exception cref="SelectionBoardOpenedException">
    /// Thrown when the board is already finalized and its group has opened.
    /// </exception>
    /// <exception cref="SelectionBoardFinalizedException">
    /// Thrown when the board is already finalized and its group is still to open.
    /// </exception>
    /// <exception cref="SelectionFinalizeBlockedException">
    /// Thrown when the board picks for no group, can't be finalized into its group, or has a slot standing empty.
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
    Task FinalizeAsync(string organizationSlug, Guid boardId, CancellationToken cancellationToken = default);
}

/// <summary>
/// Thrown when a problem would enter a hosted round without a statement and a solution in every language.
/// </summary>
public sealed class SelectionProblemIncompleteException()
    : MathCompsException(
        "A problem going into a round lacks a statement or a solution in some language",
        RefusalKind.PreconditionUnmet,
        LogLevel.Information);

/// <summary>
/// Thrown when a board cannot be finalized: it picks for no group, its group fails
/// <see cref="SelectionRules.CanFinalizeInto"/>, or a slot stands empty.
/// </summary>
public sealed class SelectionFinalizeBlockedException()
    : MathCompsException(
        "This board cannot be finalized into its cycle",
        RefusalKind.PreconditionUnmet,
        LogLevel.Information);

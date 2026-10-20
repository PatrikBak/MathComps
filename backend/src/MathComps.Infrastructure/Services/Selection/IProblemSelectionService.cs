using MathComps.Domain.Contracts.Selection;
using MathComps.Domain.Localization;
using MathComps.Infrastructure.Services.Comments;

namespace MathComps.Infrastructure.Services.Selection;

/// <summary>
/// Reads everything the problem selection holds. A board finalized into a group leaves the selection once the group
/// opens, and its problems with it.
/// </summary>
public interface IProblemSelectionService
{
    /// <summary>
    /// Reads the whole selection at once.
    /// </summary>
    /// <param name="reviewerId">The reviewer reading it, whose own ratings come back marked as theirs.</param>
    /// <param name="language">The language the cycles are named in.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>The selection.</returns>
    Task<SelectionDto> GetSelectionAsync(
        Guid reviewerId, Language language, CancellationToken cancellationToken = default);

    /// <summary>
    /// Reads the reviewers' discussions of everything the selection holds at once: of every proposal still in it,
    /// and of every paper on a board still in it.
    /// </summary>
    /// <param name="viewer">The reviewer reading the discussions.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>The discussions, by what they hang off.</returns>
    /// <exception cref="CommentTargetNotFoundException">
    /// Thrown when the viewer is no member of the organization picking the problems, as though the discussions were
    /// not there.
    /// </exception>
    Task<SelectionDiscussionsDto> GetDiscussionsAsync(
        CommentViewer viewer, CancellationToken cancellationToken = default);
}

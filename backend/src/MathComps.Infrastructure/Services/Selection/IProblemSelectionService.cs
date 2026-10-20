using MathComps.Domain.Contracts.Selection;
using MathComps.Domain.EfCoreEntities;
using MathComps.Domain.Localization;
using MathComps.Infrastructure.Services.Comments;

namespace MathComps.Infrastructure.Services.Selection;

/// <summary>
/// Reads everything an organization's problem selection holds, every proposal and board in it the organization's
/// own. A board finalized into a group leaves the selection once the group opens, and its problems with it.
/// </summary>
public interface IProblemSelectionService
{
    /// <summary>
    /// Reads an organization's whole selection at once.
    /// </summary>
    /// <param name="organizationSlug">
    /// The <see cref="Organization.Slug"/> of the organization whose selection it is.
    /// </param>
    /// <param name="reviewerId">The reviewer reading it, whose own ratings come back marked as theirs.</param>
    /// <param name="language">The language the cycles are named in.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>The selection.</returns>
    Task<SelectionDto> GetSelectionAsync(
        string organizationSlug, Guid reviewerId, Language language, CancellationToken cancellationToken = default);

    /// <summary>
    /// Reads the reviewers' discussions of everything an organization's selection holds at once: of every proposal
    /// still in it, and of every paper on a board still in it.
    /// </summary>
    /// <param name="organizationSlug">
    /// The <see cref="Organization.Slug"/> of the organization whose selection it is.
    /// </param>
    /// <param name="viewer">The reviewer reading the discussions.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>The discussions, by what they hang off; none to a member of another organization.</returns>
    /// <exception cref="CommentTargetNotFoundException">
    /// Thrown when the viewer is a member of no organization at all, as though the discussions were not there.
    /// </exception>
    Task<SelectionDiscussionsDto> GetDiscussionsAsync(
        string organizationSlug, CommentViewer viewer, CancellationToken cancellationToken = default);
}

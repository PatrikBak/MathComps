using System.Collections.Immutable;
using MathComps.Domain.Contracts.Selection;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Services.Comments;

namespace MathComps.Infrastructure.Services.Selection;

/// <summary>
/// Reads the reviewers' discussions of everything an organization's problem selection holds, and keeps how far each
/// reviewer has seen them.
/// </summary>
public interface ISelectionDiscussionService
{
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

    /// <summary>
    /// Reads how far a reviewer has seen the discussions of everything an organization's selection holds, each beside
    /// what somebody else posted in it since.
    /// </summary>
    /// <param name="organizationSlug">
    /// The <see cref="Organization.Slug"/> of the organization whose selection it is.
    /// </param>
    /// <param name="viewer">The reviewer.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>
    /// How far each discussion is seen, by what it hangs off; none to a member of another organization.
    /// </returns>
    /// <exception cref="CommentTargetNotFoundException">
    /// Thrown when the viewer is a member of no organization at all, as though the discussions were not there.
    /// </exception>
    Task<SelectionDiscussionsSeenDto> GetDiscussionsSeenAsync(
        string organizationSlug, CommentViewer viewer, CancellationToken cancellationToken = default);

    /// <summary>
    /// Marks the discussions of some of what an organization's selection holds as seen by a reviewer, each up to its
    /// own moment. A proposal or paper the selection does not hold is passed over, as is every one for a reviewer
    /// outside the organization, and a discussion already seen further keeps its mark.
    /// </summary>
    /// <param name="organizationSlug">
    /// The <see cref="Organization.Slug"/> of the organization whose selection it is.
    /// </param>
    /// <param name="viewer">The reviewer.</param>
    /// <param name="proposalsSeenUpTo">
    /// The moment up to which the reviewer has seen every comment posted in each proposal's discussion, by the
    /// proposal's id; a moment yet to come counts as now.
    /// </param>
    /// <param name="papersSeenUpTo">
    /// The moment up to which the reviewer has seen every comment posted in each paper's discussion, by the paper's
    /// id; a moment yet to come counts as now.
    /// </param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>Each discussion marked, with the moment it is now seen at least up to.</returns>
    Task<DiscussionsMarkedDto> MarkDiscussionsSeenAsync(
        string organizationSlug,
        CommentViewer viewer,
        ImmutableDictionary<Guid, DateTimeOffset> proposalsSeenUpTo,
        ImmutableDictionary<Guid, DateTimeOffset> papersSeenUpTo,
        CancellationToken cancellationToken = default);
}

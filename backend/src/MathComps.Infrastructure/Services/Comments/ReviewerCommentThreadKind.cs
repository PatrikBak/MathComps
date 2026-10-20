using MathComps.Domain.Contracts.Comments;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Organizations;
using System.Collections.Immutable;

namespace MathComps.Infrastructure.Services.Comments;

/// <summary>
/// A <see cref="CommentThreadKind{TAnchor}"/> whose threads are open only to the reviewers, the members of the
/// MathComps organization, whichever thread it is.
/// </summary>
/// <typeparam name="TAnchor">The anchor naming one of this kind's threads.</typeparam>
/// <param name="members"><inheritdoc cref="IOrganizationMemberService" path="/summary"/></param>
public abstract class ReviewerCommentThreadKind<TAnchor>(IOrganizationMemberService members)
    : CommentThreadKind<TAnchor>
    where TAnchor : CommentAnchor
{
    /// <inheritdoc />
    public override Task<bool> IsOpenAsync(
        MathCompsDbContext dbContext, CommentTarget target, CommentViewer? viewer) =>
        // Open to the reviewers, whichever thread it is
        IsReviewerAsync(viewer);

    /// <inheritdoc />
    public override async Task<IQueryable<KeyValuePair<string, int>>> CountAsync(
        MathCompsDbContext dbContext, ImmutableList<string> targetIds, CommentViewer? viewer) =>
        // The active comments of each thread the ids name, keyed by its id
        CountById(dbContext, await ReachableIdsAsync(targetIds, viewer));

    /// <inheritdoc />
    public override async Task<IQueryable<KeyValuePair<string, Guid>>> LinksAsync(
        MathCompsDbContext dbContext, ImmutableList<string> targetIds, CommentViewer viewer) =>
        // The comments of each thread the ids name, keyed by its id
        LinksById(dbContext, await ReachableIdsAsync(targetIds, viewer));

    /// <inheritdoc />
    protected override Task<bool> IsOpenToAsync(MathCompsDbContext dbContext, TAnchor anchor, CommentViewer? viewer) =>
        // Open to the reviewers
        IsReviewerAsync(viewer);

    /// <summary>
    /// The query counting the active comments in each of several of this kind's threads, for a viewer already let in.
    /// </summary>
    /// <param name="dbContext">The operation's database context.</param>
    /// <param name="ids">The threads' ids.</param>
    /// <returns>The query, each thread's count keyed by its id, a thread with none left out.</returns>
    protected abstract IQueryable<KeyValuePair<string, int>> CountById(
        MathCompsDbContext dbContext, ImmutableList<Guid> ids);

    /// <summary>
    /// The query linking every comment of several of this kind's threads to the thread it hangs off, for a viewer
    /// already let in.
    /// </summary>
    /// <param name="dbContext">The operation's database context.</param>
    /// <param name="ids">The threads' ids.</param>
    /// <returns>The query, each comment's id keyed by its thread's id.</returns>
    protected abstract IQueryable<KeyValuePair<string, Guid>> LinksById(
        MathCompsDbContext dbContext, ImmutableList<Guid> ids);

    /// <summary>
    /// The ids naming several of this kind's threads, for the reviewers alone.
    /// </summary>
    /// <param name="targetIds">The threads' target ids.</param>
    /// <param name="viewer">Who is asking; null for a signed-out caller.</param>
    /// <returns>The ids that could name a thread, an id that is no GUID left out.</returns>
    /// <exception cref="CommentTargetNotFoundException">
    /// Thrown when the viewer is no reviewer, as though the threads were not there.
    /// </exception>
    private async Task<ImmutableList<Guid>> ReachableIdsAsync(ImmutableList<string> targetIds, CommentViewer? viewer)
    {
        // Open to the reviewers alone, and refused like targets that are not there to anybody else
        if (!await IsReviewerAsync(viewer))
            throw new CommentTargetNotFoundException(TargetType, string.Join(", ", targetIds));

        // The ids that could name a thread
        return
        [
            .. targetIds
                .Select(targetId => Guid.TryParse(targetId, out var id) ? id : (Guid?)null)
                .OfType<Guid>(),
        ];
    }

    /// <summary>
    /// Whether a viewer is one of the reviewers.
    /// </summary>
    /// <param name="viewer">Who is asking; null for a signed-out caller.</param>
    /// <returns>Whether they are a reviewer.</returns>
    private async Task<bool> IsReviewerAsync(CommentViewer? viewer) =>
        // A signed-in account on the MathComps organization's list
        viewer is not null && await members.IsMemberAsync(viewer.UserId, Organization.MathCompsSlug);
}

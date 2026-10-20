using MathComps.Domain.Contracts.Comments;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Organizations;
using Microsoft.EntityFrameworkCore;
using System.Collections.Immutable;

namespace MathComps.Infrastructure.Services.Comments;

/// <summary>
/// A <see cref="CommentThreadKind{TAnchor}"/> whose threads hang off something an organization's selection holds, and
/// are open only to the reviewers, the members of that organization.
/// </summary>
/// <typeparam name="TAnchor">The anchor naming one of this kind's threads.</typeparam>
/// <param name="members"><inheritdoc cref="IOrganizationMemberService" path="/summary"/></param>
public abstract class ReviewerCommentThreadKind<TAnchor>(IOrganizationMemberService members)
    : CommentThreadKind<TAnchor>
    where TAnchor : CommentAnchor
{
    /// <inheritdoc />
    public override async Task<bool> IsOpenAsync(
        MathCompsDbContext dbContext, CommentTarget target, CommentViewer? viewer) =>
        // Open to the reviewers of the organization the target belongs to, where it names anything at all
        Guid.TryParse(target.TargetId, out var threadId) && await IsReachableAsync(dbContext, threadId, viewer);

    /// <inheritdoc />
    public override async Task<IQueryable<KeyValuePair<string, int>>> CountAsync(
        MathCompsDbContext dbContext, ImmutableList<string> targetIds, CommentViewer? viewer) =>
        // The active comments of each thread the ids name that the viewer reaches, keyed by its id
        CountById(dbContext, await ReachableIdsAsync(dbContext, targetIds, viewer));

    /// <inheritdoc />
    public override async Task<IQueryable<KeyValuePair<string, Guid>>> LinksAsync(
        MathCompsDbContext dbContext, ImmutableList<string> targetIds, CommentViewer viewer) =>
        // The comments of each thread the ids name that the viewer reaches, keyed by its id
        LinksById(dbContext, await ReachableIdsAsync(dbContext, targetIds, viewer));

    /// <summary>
    /// The query counting the active comments in each of several of this kind's threads, for a viewer already let in.
    /// </summary>
    /// <param name="dbContext">The operation's database context.</param>
    /// <param name="threadIds">The threads' ids.</param>
    /// <returns>The query, each thread's count keyed by its id, a thread with none left out.</returns>
    protected abstract IQueryable<KeyValuePair<string, int>> CountById(
        MathCompsDbContext dbContext, ImmutableList<Guid> threadIds);

    /// <summary>
    /// The query linking every comment of several of this kind's threads to the thread it hangs off, for a viewer
    /// already let in.
    /// </summary>
    /// <param name="dbContext">The operation's database context.</param>
    /// <param name="threadIds">The threads' ids.</param>
    /// <returns>The query, each comment's id keyed by its thread's id.</returns>
    protected abstract IQueryable<KeyValuePair<string, Guid>> LinksById(
        MathCompsDbContext dbContext, ImmutableList<Guid> threadIds);

    /// <summary>
    /// The query narrowing several of this kind's threads to the ones hanging off something one of several
    /// organizations' selections holds.
    /// </summary>
    /// <param name="dbContext">The operation's database context.</param>
    /// <param name="threadIds">The threads' ids.</param>
    /// <param name="organizationIds">The organizations.</param>
    /// <returns>The query, the ids of the threads that belong to one of the organizations.</returns>
    protected abstract IQueryable<Guid> InOrganizations(
        MathCompsDbContext dbContext, ImmutableList<Guid> threadIds, IReadOnlyList<Guid> organizationIds);

    /// <summary>
    /// Whether one of this kind's threads is open to a viewer: they are a member of the organization whose selection
    /// holds what it hangs off.
    /// </summary>
    /// <param name="dbContext">The operation's database context.</param>
    /// <param name="threadId">The thread's id.</param>
    /// <param name="viewer">Who is asking; null for a signed-out caller.</param>
    /// <returns>Whether the thread is open to them.</returns>
    protected async Task<bool> IsReachableAsync(MathCompsDbContext dbContext, Guid threadId, CommentViewer? viewer) =>
        // A signed-in member of the organization the thread belongs to
        viewer is not null
        && await InOrganizations(dbContext, [threadId], await members.GetOrganizationIdsAsync(viewer.UserId))
            .AnyAsync();

    /// <summary>
    /// The ids naming several of this kind's threads, narrowed to the ones open to the viewer.
    /// </summary>
    /// <param name="dbContext">The operation's database context.</param>
    /// <param name="targetIds">The threads' target ids.</param>
    /// <param name="viewer">Who is asking; null for a signed-out caller.</param>
    /// <returns>
    /// The ids of the threads the viewer is a reviewer of, every other id left out.
    /// </returns>
    /// <exception cref="CommentTargetNotFoundException">
    /// Thrown when the viewer is signed out or a member of no organization, as though the threads were not there.
    /// </exception>
    private async Task<ImmutableList<Guid>> ReachableIdsAsync(
        MathCompsDbContext dbContext, ImmutableList<string> targetIds, CommentViewer? viewer)
    {
        // Open to the reviewers alone, the members of some organization, and refused like targets that are not there
        // to anybody else
        if (viewer is null
            || await members.GetOrganizationIdsAsync(viewer.UserId) is not { Count: > 0 } organizationIds)
            throw new CommentTargetNotFoundException(TargetType, string.Join(", ", targetIds));

        // The ids that could name a thread
        ImmutableList<Guid> threadIds =
        [
            .. targetIds
                .Select(targetId => Guid.TryParse(targetId, out var id) ? id : (Guid?)null)
                .OfType<Guid>(),
        ];

        // The ids of the threads the viewer's organizations hold
        return [.. await InOrganizations(dbContext, threadIds, organizationIds).ToListAsync()];
    }
}

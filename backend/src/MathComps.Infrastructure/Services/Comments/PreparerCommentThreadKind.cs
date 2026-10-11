using MathComps.Domain.Contracts.Comments;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Users;
using System.Collections.Immutable;

namespace MathComps.Infrastructure.Services.Comments;

/// <summary>
/// A <see cref="CommentThreadKind{TAnchor}"/> whose threads are open only to the accounts preparing the competitions,
/// whichever thread it is.
/// </summary>
/// <typeparam name="TAnchor">The anchor naming one of this kind's threads.</typeparam>
/// <param name="grants"><inheritdoc cref="IUserGrantService" path="/summary"/></param>
public abstract class PreparerCommentThreadKind<TAnchor>(IUserGrantService grants) : CommentThreadKind<TAnchor>
    where TAnchor : CommentAnchor
{
    /// <inheritdoc />
    public override Task<bool> IsOpenAsync(
        MathCompsDbContext dbContext, CommentTarget target, CommentViewer? viewer) =>
        // Open to the accounts preparing the competitions, whichever thread it is
        IsPreparingCompetitionsAsync(viewer);

    /// <inheritdoc />
    public override async Task<IQueryable<KeyValuePair<string, int>>> CountAsync(
        MathCompsDbContext dbContext, ImmutableList<string> targetIds, CommentViewer? viewer)
    {
        // Counted for the accounts preparing the competitions alone, and refused like targets that are not there to
        // anybody else
        if (!await IsPreparingCompetitionsAsync(viewer))
            throw new CommentTargetNotFoundException(TargetType, string.Join(", ", targetIds));

        // The ids that could name a thread
        var ids = targetIds
            .Select(targetId => Guid.TryParse(targetId, out var id) ? id : (Guid?)null)
            .OfType<Guid>()
            .ToImmutableList();

        // The active comments of each thread the ids name, keyed by its id
        return CountById(dbContext, ids);
    }

    /// <inheritdoc />
    protected override Task<bool> IsOpenToAsync(MathCompsDbContext dbContext, TAnchor anchor, CommentViewer? viewer) =>
        // Open to the accounts preparing the competitions
        IsPreparingCompetitionsAsync(viewer);

    /// <summary>
    /// The query counting the active comments in each of several of this kind's threads, for a viewer already let in.
    /// </summary>
    /// <param name="dbContext">The operation's database context.</param>
    /// <param name="ids">The threads' ids.</param>
    /// <returns>The query, each thread's count keyed by its id, a thread with none left out.</returns>
    protected abstract IQueryable<KeyValuePair<string, int>> CountById(
        MathCompsDbContext dbContext, ImmutableList<Guid> ids);

    /// <summary>
    /// Whether a viewer is one of the accounts preparing the competitions.
    /// </summary>
    /// <param name="viewer">Who is asking; null for a signed-out caller.</param>
    /// <returns>Whether they prepare the competitions.</returns>
    private async Task<bool> IsPreparingCompetitionsAsync(CommentViewer? viewer) =>
        // A signed-in account holding the PrepareCompetitions grant
        viewer is not null && await grants.HasAsync(viewer.UserId, UserCapability.PrepareCompetitions);
}

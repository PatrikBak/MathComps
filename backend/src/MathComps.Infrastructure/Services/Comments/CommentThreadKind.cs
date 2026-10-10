using MathComps.Domain.Contracts.Comments;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Persistence;
using System.Collections.Immutable;

namespace MathComps.Infrastructure.Services.Comments;

/// <summary>
/// An <see cref="ICommentThreadKind"/> whose threads are told apart by one type of anchor, handed to each member as
/// that type.
/// </summary>
/// <typeparam name="TAnchor">The anchor naming one of this kind's threads.</typeparam>
public abstract class CommentThreadKind<TAnchor> : ICommentThreadKind where TAnchor : CommentAnchor
{
    /// <inheritdoc />
    public abstract CommentTargetType TargetType { get; }

    /// <inheritdoc />
    public abstract bool TakesLikes { get; }

    /// <inheritdoc />
    public abstract Task<bool> IsOpenAsync(MathCompsDbContext dbContext, CommentTarget target, CommentViewer? viewer);

    /// <inheritdoc />
    Task<bool> ICommentThreadKind.IsOpenToAsync(
        MathCompsDbContext dbContext, CommentAnchor anchor, CommentViewer? viewer) =>
        // Decided on the thread as this kind's anchor
        IsOpenToAsync(dbContext, (TAnchor)anchor, viewer);

    /// <inheritdoc />
    async Task<CommentAnchor> ICommentThreadKind.ResolveAsync(MathCompsDbContext dbContext, CommentTarget target) =>
        // The thread, as the anchor every kind shares
        await ResolveAsync(dbContext, target);

    /// <inheritdoc />
    public abstract Task<CommentThreadSql> SelectAsync(MathCompsDbContext dbContext, CommentTarget target);

    /// <inheritdoc />
    async Task<CommentAnchor?> ICommentThreadKind.FindAsync(MathCompsDbContext dbContext, Guid commentId) =>
        // The thread, if any, as the anchor every kind shares
        await FindAsync(dbContext, commentId);

    /// <inheritdoc />
    void ICommentThreadKind.Attach(MathCompsDbContext dbContext, CommentAnchor anchor, Guid commentId) =>
        // Linked through the thread as this kind's anchor
        Attach(dbContext, (TAnchor)anchor, commentId);

    /// <inheritdoc />
    public abstract Task<IQueryable<KeyValuePair<string, int>>> CountAsync(
        MathCompsDbContext dbContext, ImmutableList<string> targetIds, CommentViewer? viewer);

    /// <inheritdoc />
    Task ICommentThreadKind.OnCreatedAsync(MathCompsDbContext dbContext, CommentAnchor anchor, Comment comment) =>
        // Tracked against the thread as this kind's anchor
        OnCreatedAsync(dbContext, (TAnchor)anchor, comment);

    /// <inheritdoc />
    public virtual Task OnEditedAsync(MathCompsDbContext dbContext, Guid previousVersionId, Guid newVersionId) =>
        // A comment with nothing hanging off it
        Task.CompletedTask;

    /// <inheritdoc cref="ICommentThreadKind.IsOpenToAsync" path="/summary"/>
    /// <param name="dbContext">The operation's database context.</param>
    /// <param name="anchor">The thread.</param>
    /// <param name="viewer">Who is asking; null for a signed-out caller.</param>
    /// <returns>Whether the thread is open to them.</returns>
    protected abstract Task<bool> IsOpenToAsync(MathCompsDbContext dbContext, TAnchor anchor, CommentViewer? viewer);

    /// <inheritdoc cref="ICommentThreadKind.ResolveAsync" path="/summary"/>
    /// <param name="dbContext">The operation's database context.</param>
    /// <param name="target">The thread's target.</param>
    /// <returns>The thread the target names.</returns>
    /// <exception cref="CommentTargetNotFoundException">Thrown when the target names no thread.</exception>
    protected abstract Task<TAnchor> ResolveAsync(MathCompsDbContext dbContext, CommentTarget target);

    /// <inheritdoc cref="ICommentThreadKind.FindAsync" path="/summary"/>
    /// <param name="dbContext">The operation's database context.</param>
    /// <param name="commentId">The comment.</param>
    /// <returns>
    /// The thread, or null when the comment hangs off none of this kind's threads or off one nobody can reach.
    /// </returns>
    protected abstract Task<TAnchor?> FindAsync(MathCompsDbContext dbContext, Guid commentId);

    /// <inheritdoc cref="ICommentThreadKind.Attach" path="/summary"/>
    /// <param name="dbContext">The operation's database context.</param>
    /// <param name="anchor">The thread.</param>
    /// <param name="commentId">The comment.</param>
    protected abstract void Attach(MathCompsDbContext dbContext, TAnchor anchor, Guid commentId);

    /// <inheritdoc cref="ICommentThreadKind.OnCreatedAsync" path="/summary"/>
    /// <param name="dbContext">The context the comment is being saved through.</param>
    /// <param name="anchor">The thread.</param>
    /// <param name="comment">The new comment, not yet saved.</param>
    /// <returns>A task that completes once whatever the comment owes is tracked.</returns>
    protected virtual Task OnCreatedAsync(MathCompsDbContext dbContext, TAnchor anchor, Comment comment) =>
        // A comment owing nothing beyond its own row
        Task.CompletedTask;
}

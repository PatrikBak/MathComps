using MathComps.Domain.Contracts.Comments;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Persistence;
using System.Collections.Immutable;

namespace MathComps.Infrastructure.Services.Comments;

/// <summary>
/// One kind of comment thread, the one a <see cref="CommentTargetType"/> names: who may reach its threads, and how a
/// comment is stored in one, read back and counted. Everything else about a thread is the same for every kind.
/// </summary>
/// <remarks>
/// A thread the viewer may not reach is refused as though it did not exist, so each such refusal is a
/// <see cref="CommentTargetNotFoundException"/> for a target and a <see cref="CommentNotFoundException"/> for a
/// comment.
/// </remarks>
public interface ICommentThreadKind
{
    /// <summary>
    /// The type of target naming this kind's threads.
    /// </summary>
    CommentTargetType TargetType { get; }

    /// <summary>
    /// Whether a comment in one of this kind's threads can be liked.
    /// </summary>
    bool TakesLikes { get; }

    /// <summary>
    /// Whether a viewer may reach the thread a target names, decided before anything is written for it.
    /// </summary>
    /// <param name="dbContext">The operation's database context.</param>
    /// <param name="target">The thread asked for.</param>
    /// <param name="viewer">Who is asking; null for a signed-out caller.</param>
    /// <returns>Whether the thread is open to them.</returns>
    Task<bool> IsOpenAsync(MathCompsDbContext dbContext, CommentTarget target, CommentViewer? viewer);

    /// <summary>
    /// Whether a viewer may read and write in a thread whose anchor is known.
    /// </summary>
    /// <param name="dbContext">The operation's database context.</param>
    /// <param name="anchor">The thread, one of this kind's.</param>
    /// <param name="viewer">Who is asking; null for a signed-out caller.</param>
    /// <returns>Whether the thread is open to them.</returns>
    Task<bool> IsOpenToAsync(MathCompsDbContext dbContext, CommentAnchor anchor, CommentViewer? viewer);

    /// <summary>
    /// Resolves the thread a target names for writing in it, minting the row file-based content hangs its comments
    /// off the first time anything is attached to it.
    /// </summary>
    /// <param name="dbContext">The operation's database context.</param>
    /// <param name="target">The thread's target.</param>
    /// <returns>The thread the target names.</returns>
    /// <exception cref="CommentTargetNotFoundException">Thrown when the target names no thread.</exception>
    Task<CommentAnchor> ResolveAsync(MathCompsDbContext dbContext, CommentTarget target);

    /// <summary>
    /// The JOIN and WHERE picking out the comments of the thread a target names. Reading writes nothing,
    /// so a thread nothing hangs off yet simply comes back empty.
    /// </summary>
    /// <param name="dbContext">The operation's database context.</param>
    /// <param name="target">The thread's target.</param>
    /// <returns>The fragments, with the values the WHERE compares against.</returns>
    /// <exception cref="CommentTargetNotFoundException">Thrown when the target names no thread.</exception>
    Task<CommentThreadSql> SelectAsync(MathCompsDbContext dbContext, CommentTarget target);

    /// <summary>
    /// Finds the thread of this kind a stored comment hangs off.
    /// </summary>
    /// <param name="dbContext">The operation's database context.</param>
    /// <param name="commentId">The comment.</param>
    /// <returns>
    /// The thread, or null when the comment hangs off none of this kind's threads or off one nobody can reach.
    /// </returns>
    Task<CommentAnchor?> FindAsync(MathCompsDbContext dbContext, Guid commentId);

    /// <summary>
    /// Links a comment into one of this kind's threads.
    /// </summary>
    /// <param name="dbContext">The operation's database context.</param>
    /// <param name="anchor">The thread, one of this kind's.</param>
    /// <param name="commentId">The comment.</param>
    void Attach(MathCompsDbContext dbContext, CommentAnchor anchor, Guid commentId);

    /// <summary>
    /// The query counting the active comments in each of several of this kind's threads.
    /// </summary>
    /// <param name="dbContext">The operation's database context.</param>
    /// <param name="targetIds">The threads' target ids.</param>
    /// <param name="viewer">Who is asking; null for a signed-out caller.</param>
    /// <returns>The query, each thread's count keyed by its target id, a thread with none left out.</returns>
    /// <exception cref="CommentTargetNotFoundException">Thrown when the viewer may not reach the threads.</exception>
    /// <exception cref="ArgumentException">Thrown when this kind is never counted in bulk.</exception>
    Task<IQueryable<KeyValuePair<string, int>>> CountAsync(
        MathCompsDbContext dbContext, ImmutableList<string> targetIds, CommentViewer? viewer);

    /// <summary>
    /// Whatever a new comment owes beyond its own row, saved along with it.
    /// </summary>
    /// <param name="dbContext">The context the comment is being saved through.</param>
    /// <param name="anchor">The thread, one of this kind's.</param>
    /// <param name="comment">The new comment, not yet saved.</param>
    /// <returns>A task that completes once whatever the comment owes is tracked.</returns>
    Task OnCreatedAsync(MathCompsDbContext dbContext, CommentAnchor anchor, Comment comment);

    /// <summary>
    /// Carries whatever hangs off a comment onto the version an edit writes, saved along with it.
    /// </summary>
    /// <param name="dbContext">The context the edit is being saved through.</param>
    /// <param name="previousVersionId">The version the edit replaces.</param>
    /// <param name="newVersionId">The version the edit writes.</param>
    /// <returns>A task that completes once everything is carried over.</returns>
    Task OnEditedAsync(MathCompsDbContext dbContext, Guid previousVersionId, Guid newVersionId);
}

/// <summary>
/// The JOIN and WHERE a thread's read query uses to pick out the thread's comments, from <c>comments c</c>.
/// </summary>
/// <param name="Join">The JOIN reaching the thread's links.</param>
/// <param name="Where">The condition picking the thread's links, with its values as <c>@p0</c>, <c>@p1</c>, …</param>
/// <param name="Parameters">The values the WHERE compares against, in order.</param>
public sealed record CommentThreadSql(string Join, string Where, object[] Parameters);

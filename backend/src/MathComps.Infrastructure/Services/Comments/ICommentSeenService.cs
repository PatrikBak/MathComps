using MathComps.Domain.Contracts.Comments;
using System.Collections.Immutable;

namespace MathComps.Infrastructure.Services.Comments;

/// <summary>
/// Keeps how far each reader has seen each comment target's whole discussion, and tells what anybody else posted in
/// one since, which is what in it is new to that reader.
/// </summary>
public interface ICommentSeenService
{
    /// <summary>
    /// Reads how far a viewer has seen several threads of one kind, each beside what somebody else posted in it since.
    /// </summary>
    /// <param name="targetType">The kind of the threads.</param>
    /// <param name="targetIds">The threads' target ids.</param>
    /// <param name="viewer">The reader.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>
    /// Each thread's <see cref="CommentThreadSeenDto"/> keyed by its target id, one per thread asked for, a thread
    /// never seen and never posted in included.
    /// </returns>
    /// <exception cref="CommentTargetNotFoundException">Thrown when the viewer may not reach the threads.</exception>
    /// <exception cref="NotSupportedException">Thrown when this kind of thread is never read in bulk.</exception>
    Task<ImmutableDictionary<string, CommentThreadSeenDto>> GetSeenAsync(
        CommentTargetType targetType,
        ImmutableList<string> targetIds,
        CommentViewer viewer,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Marks several threads of one kind as seen by a viewer, each up to its own moment, a mark already further along
    /// left where it is. The caller vouches that the viewer may reach the threads.
    /// </summary>
    /// <param name="targetType">The kind of the threads.</param>
    /// <param name="seenUpTo">
    /// The moment up to which the viewer has seen every comment and reply posted in each thread, by its target id.
    /// </param>
    /// <param name="viewer">The reader.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>A task that completes once the marks are saved.</returns>
    Task MarkSeenAsync(
        CommentTargetType targetType,
        ImmutableDictionary<string, DateTimeOffset> seenUpTo,
        CommentViewer viewer,
        CancellationToken cancellationToken = default);
}

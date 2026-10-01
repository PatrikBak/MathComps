using MathComps.Domain.EfCoreEntities;
using MathComps.Domain.Contracts.Comments;
using System.Collections.Immutable;

namespace MathComps.Infrastructure.Services.Comments;

/// <summary>
/// A service for reading and writing comment threads.
/// </summary>
/// <remarks>
/// Every operation is told who is asking, which for a read can be nobody. A thread the viewer may not reach,
/// and every comment in it, is refused as though it did not exist: <see cref="CommentTargetNotFoundException"/>
/// for a target, <see cref="CommentNotFoundException"/> for a comment. Problems, handouts and news are open to
/// anybody; a grade conversation only to admins. A version an edit has replaced is refused with
/// <see cref="CommentNotFoundException"/> too.
/// </remarks>
public interface ICommentService
{
    /// <summary>
    /// Reads a target's thread as a tree of replies. A version an edit has replaced is left out, and a deleted
    /// comment comes back with its content emptied.
    /// </summary>
    /// <param name="target">The target of the comments.</param>
    /// <param name="viewer">Who is asking; null for a signed-out caller.</param>
    /// <returns>The thread's top-level comments, each carrying its replies.</returns>
    Task<ImmutableList<CommentDto>> GetCommentsAsync(CommentTarget target, CommentViewer? viewer);

    /// <summary>
    /// Creates a new comment or reply. A reply whose parent sits in another thread is refused as though the
    /// parent did not exist, and an author with no username to sign it with is refused with
    /// <see cref="CommentProfileIncompleteException"/>.
    /// </summary>
    /// <param name="target">The target of the comment.</param>
    /// <param name="viewer">The user creating the comment.</param>
    /// <param name="content"><inheritdoc cref="Comment.Content" path="/summary"/></param>
    /// <param name="parentCommentId"><inheritdoc cref="Comment.ParentCommentId" path="/summary"/></param>
    /// <returns>The created comment.</returns>
    Task<CommentDto> CreateCommentAsync(
        CommentTarget target, CommentViewer viewer, string content, Guid? parentCommentId = null);

    /// <summary>
    /// Edits a comment by writing a new version of it. The new version stays in the thread the comment was
    /// written in and keeps its replies and its posting time. A deleted comment is refused as though it did not
    /// exist.
    /// </summary>
    /// <param name="commentId">The ID of the comment to update.</param>
    /// <param name="viewer">The user making the edit (must be the author).</param>
    /// <param name="content"><inheritdoc cref="Comment.Content" path="/summary"/></param>
    /// <returns>The new version's id and when it was written.</returns>
    Task<UpdateCommentResult> UpdateCommentAsync(Guid commentId, CommentViewer viewer, string content);

    /// <summary>
    /// Deletes a comment, which stays in its thread with its content hidden and its replies kept.
    /// </summary>
    /// <param name="commentId">The ID of the comment to delete.</param>
    /// <param name="viewer">The user deleting (must be the author).</param>
    Task DeleteCommentAsync(Guid commentId, CommentViewer viewer);

    /// <summary>
    /// Toggles a like on a comment. Creates a like if it doesn't exist, removes it if it does. A comment in a
    /// grade conversation takes no likes and is refused as though it did not exist.
    /// </summary>
    /// <param name="commentId">The ID of the comment to like/unlike.</param>
    /// <param name="viewer">The user toggling the like.</param>
    Task ToggleLikeAsync(Guid commentId, CommentViewer viewer);

    /// <summary>
    /// Counts the active comments on each of several targets of one type. Only handouts and news articles are
    /// counted in bulk, and any other type throws <see cref="ArgumentException"/>.
    /// </summary>
    /// <param name="targetType">The type of the targets.</param>
    /// <param name="targetIds">The ids of the targets.</param>
    /// <param name="viewer">Who is asking; null for a signed-out caller.</param>
    /// <returns>Each target's active comment count by its id, a target with none left out.</returns>
    Task<ImmutableDictionary<string, int>> GetCommentCountsAsync(
        CommentTargetType targetType, ImmutableList<string> targetIds, CommentViewer? viewer);
}

/// <summary>
/// Thrown when a comment does not exist, or is refused as though it did not.
/// </summary>
public sealed class CommentNotFoundException() : Exception("Comment not found");

/// <summary>
/// Thrown when a comment target does not exist, or is refused as though it did not.
/// </summary>
/// <param name="targetType">The kind of target asked for.</param>
/// <param name="targetId">The identifier, or comma-separated identifiers, asked for.</param>
public sealed class CommentTargetNotFoundException(CommentTargetType targetType, string targetId)
    : Exception($"{targetType} target '{targetId}' not found");

/// <summary>
/// Thrown when the caller is not the author of the comment they tried to modify.
/// </summary>
public sealed class NotCommentAuthorException() : Exception("Only the author can modify this comment");

/// <summary>
/// Thrown when the caller tries to like their own comment.
/// </summary>
public sealed class CannotLikeOwnCommentException() : Exception("You cannot like your own comment");

/// <summary>
/// Thrown when a comment is written from an account with no username to sign it.
/// </summary>
public sealed class CommentProfileIncompleteException() : Exception("A comment needs a username to sign it");

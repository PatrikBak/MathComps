using MathComps.Domain.EfCoreEntities;
using MathComps.Domain.Contracts.Comments;
using System.Collections.Immutable;

namespace MathComps.Infrastructure.Services.Comments;

/// <summary>
/// Defines the contract for managing user comments on content.
/// </summary>
public interface ICommentService
{
    /// <summary>    
    /// Gets all comments for a target as a threaded tree. Does not return 
    /// <see cref="CommentStatus.Superseded"/> comments. It does return 
    /// <see cref="CommentStatus.Deleted"/> comments but without content.
    /// </summary>
    /// <param name="target">The target of the comments.</param>
    /// <param name="userId">The ID of the currently logged-in user (optional).</param>
    /// <returns>A response containing the threaded comment tree.</returns>
    Task<ImmutableList<CommentDto>> GetCommentsAsync(CommentTarget target, Guid? userId);

    /// <summary>
    /// Creates a new comment or reply.
    /// </summary>
    /// <param name="target">The target of the comment.</param>
    /// <param name="authorId">The ID of the user creating the comment.</param>
    /// <param name="content">The content of the comment.</param>
    /// <param name="parentCommentId">The optional ID of the parent comment being replied to.</param>
    /// <returns>The created comment.</returns>
    Task<CommentDto> CreateCommentAsync(CommentTarget target, Guid authorId, string content, Guid? parentCommentId = null);

    /// <summary>
    /// Updates a comment's content (creates a new version, marks old as <see cref="CommentStatus.Superseded"/>).
    /// </summary>
    /// <param name="target">The target the comment belongs to.</param>
    /// <param name="commentId">The ID of the comment to update.</param>
    /// <param name="userId">The ID of the user making the edit (must be the author).</param>
    /// <param name="content">The new content of the comment.</param>
    /// <returns>The data created by the update operation.</returns>
    Task<UpdateCommentResult> UpdateCommentAsync(CommentTarget target, Guid commentId, Guid userId, string content);

    /// <summary>
    /// Soft-deletes a comment (sets status to <see cref="CommentStatus.Deleted"/>).
    /// </summary>
    /// <param name="commentId">The ID of the comment to delete.</param>
    /// <param name="userId">The ID of the user deleting (must be the author).</param>
    Task DeleteCommentAsync(Guid commentId, Guid userId);

    /// <summary>
    /// Toggles a like on a comment. Creates a like if it doesn't exist, removes it if it does.
    /// </summary>
    /// <param name="commentId">The ID of the comment to like/unlike.</param>
    /// <param name="userId">The ID of the user toggling the like.</param>
    Task ToggleLikeAsync(Guid commentId, Guid userId);

    /// <summary>
    /// Gets the comment count for multiple targets of the same type. Only returns active comments.
    /// </summary>
    /// <param name="targetType">The type of the targets.</param>
    /// <param name="targetIds">The ids of the targets.</param>
    /// <returns>A dictionary mapping target ids to comment counts.</returns>
    Task<ImmutableDictionary<string, int>> GetCommentCountsAsync(CommentTargetType targetType, ImmutableList<string> targetIds);
}

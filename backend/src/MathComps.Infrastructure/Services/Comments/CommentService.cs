using MathComps.Domain.Contracts.Comments;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System.Collections.Immutable;

namespace MathComps.Infrastructure.Services.Comments;

/// <summary>
/// Service for managing user comments on content.
/// </summary>
/// <param name="dbContext">The database context.</param>
/// <param name="logger">The logger.</param>
public class CommentService(MathCompsDbContext dbContext, ILogger<CommentService> logger) : ICommentService
{
    #region Private Types

    /// <summary>
    /// Internal type for mapping raw SQL query results.
    /// </summary>
    /// <param name="Id"><inheritdoc cref="Comment.Id" path="/summary"/></param>
    /// <param name="ParentCommentId"><inheritdoc cref="Comment.ParentCommentId" path="/summary"/></param>
    /// <param name="AuthorExternalId"><inheritdoc cref="CommentAuthorDto.Id" path="/summary"/></param>
    /// <param name="AuthorName"><inheritdoc cref="CommentAuthorDto.Name" path="/summary"/></param>
    /// <param name="AuthorAvatarUrl"><inheritdoc cref="CommentAuthorDto.AvatarUrl" path="/summary"/></param>
    /// <param name="Content"><inheritdoc cref="Comment.Content" path="/summary"/></param>
    /// <param name="Status"><inheritdoc cref="Comment.Status" path="/summary"/></param>
    /// <param name="CreatedAt"><inheritdoc cref="Comment.CreatedAt" path="/summary"/></param>
    /// <param name="PreviousVersionId"><inheritdoc cref="Comment.PreviousVersionId" path="/summary" /></param>
    private record CommentRow(
        Guid Id,
        Guid? ParentCommentId,
        string AuthorExternalId,
        string AuthorName,
        string? AuthorAvatarUrl,
        string Content,
        CommentStatus Status,
        DateTimeOffset CreatedAt,
        Guid? PreviousVersionId
    );

    #endregion

    #region ICommentService Implementation

    /// <inheritdoc />
    public async Task<ImmutableList<CommentDto>> GetCommentsAsync(CommentTarget target, Guid? userId)
    {
        // Build the CTE-based query to fetch all comments for the target
        var (sql, parameters) = BuildCommentsCte(target);

        // Execute the raw SQL query and map to a helper type
        var flatComments = await dbContext.Database
            .SqlQueryRaw<CommentRow>(sql, parameters)
            .ToListAsync();

        // Get all comment IDs for fetching like counts and user like status
        var commentIds = flatComments.Select(comment => comment.Id).ToHashSet();

        // Fetch like counts for all comments
        var likeCounts = await dbContext.CommentLikes
            .Where(commentLike => commentIds.Contains(commentLike.CommentId))
            .GroupBy(commentLike => commentLike.CommentId)
            .Select(group => new { CommentId = group.Key, Count = group.Count() })
            .ToDictionaryAsync(group => group.CommentId, group => group.Count);

        // Fetch user's likes (if authenticated)
        var userLikes = userId.HasValue
            ? await dbContext.CommentLikes
                .Where(commentLike => commentIds.Contains(commentLike.CommentId) && commentLike.UserId == userId.Value)
                .Select(commentLike => commentLike.CommentId)
                .ToHashSetAsync()
            : [];

        // Build the threaded tree structure, a dictionary of comment IDs to their children
        var childrenMap = flatComments
            .Where(comment => comment.ParentCommentId != null)
            .GroupBy(comment => comment.ParentCommentId!.Value)
            .ToDictionary(group => group.Key, group => group.ToList());

        // A helper function to recursively build the final DTOs to be returned
        // The final object already has its children built
        CommentDto BuildDto(CommentRow row)
        {
            // Get the children of the comment
            var children = childrenMap.GetValueOrDefault(row.Id, []);

            // Build chronological replies
            var replies = children
                .OrderBy(comment => comment.CreatedAt)
                .Select(BuildDto)
                .ToImmutableList();

            // Create the author DTO directly from row data
            var author = new CommentAuthorDto(
                row.AuthorExternalId,
                row.AuthorName,
                row.AuthorAvatarUrl);

            // Get the like count of the comment
            var likeCount = likeCounts.GetValueOrDefault(row.Id, 0);

            // Determine if deleted
            var isDeleted = row.Status == CommentStatus.Deleted;

            // Strip content if deleted
            var content = isDeleted ? string.Empty : row.Content;

            // Build the comment object
            return new CommentDto(
                Id: row.Id,
                Author: author,
                Content: content,
                CreatedAt: row.CreatedAt,
                EditedAt: row.PreviousVersionId.HasValue ? row.CreatedAt : null,
                IsDeleted: isDeleted,
                LikeCount: likeCount,
                IsLiked: userLikes.Contains(row.Id),
                Replies: replies
            );
        }

        // Get the top-level comments, ordered chronologically
        var topLevel = flatComments
            .Where(comment => comment.ParentCommentId == null)
            .OrderBy(comment => comment.CreatedAt)
            .Select(BuildDto)
            .ToImmutableList();

        // Log the number of comments fetched
        logger.LogDebug("Fetched {Count} comments for {TargetType}:{TargetId}",
            flatComments.Count,
            target.TargetType,
            target.TargetId);

        // Return the top-level comments
        return topLevel;
    }

    /// <inheritdoc />
    public async Task<CommentDto> CreateCommentAsync(CommentTarget target, Guid authorId, string content, Guid? parentCommentId = null)
    {
        // Create the comment entity
        var comment = new Comment
        {
            AuthorId = authorId,
            ParentCommentId = parentCommentId,
            Content = content,
            Status = CommentStatus.Active,
            CreatedAt = DateTimeOffset.UtcNow
        };

        // Add the comment to the database
        dbContext.Comments.Add(comment);

        // Create the join table entry based on target type
        switch (target.TargetType)
        {
            case CommentTargetType.Handout:
                // The row standing in for the handout, minted now if nothing has hung off it yet
                var handoutId = await ContentAnchors.EnsureHandoutAsync(dbContext, target.TargetId);

                // Add a comment
                dbContext.HandoutComments.Add(new HandoutComment
                {
                    HandoutId = handoutId,
                    CommentId = comment.Id
                });

                break;

            case CommentTargetType.News:
                // The row standing in for the article, minted now if nothing has hung off it yet
                var newsArticleId = await ContentAnchors.EnsureNewsArticleAsync(dbContext, target.TargetId);

                // Add a comment
                dbContext.NewsArticleComments.Add(new NewsArticleComment
                {
                    NewsArticleId = newsArticleId,
                    CommentId = comment.Id
                });

                break;

            case CommentTargetType.Problem:
                // Fetch the problem's id
                var problemId = (await dbContext.Problems
                    .Where(problem => problem.Slug == target.TargetId)
                    .Select(problem => (Guid?)problem.Id)
                    .FirstOrDefaultAsync())
                    // It must exist
                    ?? throw new CommentTargetNotFoundException(target.TargetType, target.TargetId);

                // Add a comment
                dbContext.ProblemComments.Add(new ProblemComment
                {
                    ProblemId = problemId,
                    CommentId = comment.Id
                });

                break;

            // Unhandled target type
            default:
                throw new ArgumentOutOfRangeException(nameof(target), target.TargetType, "Invalid comment target type");
        }

        // Save the comment
        await dbContext.SaveChangesAsync();

        // Fetch author info
        var author = (await dbContext.Users
            .Where(user => user.Id == authorId)
            .Select(user => new CommentAuthorDto(user.ExternalId, user.DisplayName, user.AvatarUrl))
            .FirstOrDefaultAsync())
            // It must exist
            ?? throw new InvalidOperationException($"Author with id '{authorId}' not found");

        // Log the creation of the comment
        logger.LogInformation("Created comment {CommentId} by user {AuthorId} on {TargetType}:{TargetId}", comment.Id, authorId, target.TargetType, target.TargetId);

        // Return the comment's data
        return new CommentDto(
            Id: comment.Id,
            Author: author,
            Content: comment.Content,
            CreatedAt: comment.CreatedAt,
            EditedAt: null,
            IsDeleted: false,
            LikeCount: 0,
            IsLiked: false,
            Replies: []
        );
    }

    /// <inheritdoc />
    public async Task<UpdateCommentResult> UpdateCommentAsync(CommentTarget target, Guid commentId, Guid userId, string content)
    {
        // Get the existing comment
        var existingComment = await dbContext.Comments.FirstOrDefaultAsync(comment => comment.Id == commentId)
            // It must exist
            ?? throw new CommentNotFoundException();

        // Verify ownership
        if (existingComment.AuthorId != userId)
            throw new NotCommentAuthorException();

        // Create new version
        var newComment = new Comment
        {
            AuthorId = userId,
            ParentCommentId = existingComment.ParentCommentId,
            PreviousVersionId = existingComment.Id,
            Content = content,
            Status = CommentStatus.Active,
            CreatedAt = DateTimeOffset.UtcNow
        };

        // Mark old as superseded
        existingComment.Status = CommentStatus.Superseded;

        // Add the new comment
        dbContext.Comments.Add(newComment);

        // Link the new comment to the same target
        switch (target.TargetType)
        {
            case CommentTargetType.Handout:
                // Get the handout's id
                var handoutId = (await dbContext.Handouts
                    .Where(handout => handout.ContentId == target.TargetId)
                    .Select(handout => (Guid?)handout.Id)
                    .FirstOrDefaultAsync())
                    // It must exist
                    ?? throw new CommentTargetNotFoundException(target.TargetType, target.TargetId);

                // Add the comment to the handout
                dbContext.HandoutComments.Add(new HandoutComment
                {
                    HandoutId = handoutId,
                    CommentId = newComment.Id
                });
                break;

            case CommentTargetType.News:
                // Get the news article's id
                var newsArticleId = (await dbContext.NewsArticles
                    .Where(newsArticle => newsArticle.ContentId == target.TargetId)
                    .Select(newsArticle => (Guid?)newsArticle.Id)
                    .FirstOrDefaultAsync())
                    // It must exist
                    ?? throw new CommentTargetNotFoundException(target.TargetType, target.TargetId);

                // Add the comment to the news article
                dbContext.NewsArticleComments.Add(new NewsArticleComment
                {
                    NewsArticleId = newsArticleId,
                    CommentId = newComment.Id
                });
                break;

            case CommentTargetType.Problem:
                // Get the problem's id
                var problemId = (await dbContext.Problems
                    .Where(problem => problem.Slug == target.TargetId)
                    .Select(problem => (Guid?)problem.Id)
                    .FirstOrDefaultAsync())
                    // It must exist
                    ?? throw new CommentTargetNotFoundException(target.TargetType, target.TargetId);

                // Add the comment to the problem
                dbContext.ProblemComments.Add(new ProblemComment
                {
                    ProblemId = problemId,
                    CommentId = newComment.Id
                });
                break;

            // Unhandled target type
            default:
                throw new ArgumentOutOfRangeException(nameof(target), target.TargetType, "Invalid comment target type");
        }

        // Save all changes
        await dbContext.SaveChangesAsync();

        // Log the update
        logger.LogInformation(
            "Updated comment {OldCommentId} -> {NewCommentId} by user {UserId}",
            commentId,
            newComment.Id,
            userId);

        // Return just the essential data (new ID and editedAt timestamp)
        return new UpdateCommentResult(newComment.Id, newComment.CreatedAt);
    }

    /// <inheritdoc />
    public async Task DeleteCommentAsync(Guid commentId, Guid userId)
    {
        // Get the comment
        var comment = await dbContext.Comments.FirstOrDefaultAsync(comment => comment.Id == commentId)
            // It must exist
            ?? throw new CommentNotFoundException();

        // Verify ownership
        if (comment.AuthorId != userId)
            throw new NotCommentAuthorException();

        // Soft-delete
        comment.Status = CommentStatus.Deleted;

        // Save all changes
        await dbContext.SaveChangesAsync();

        // Log the deletion
        logger.LogInformation(
            "Soft-deleted comment {CommentId} by user {UserId}",
            commentId,
            userId);
    }

    /// <inheritdoc />
    public async Task ToggleLikeAsync(Guid commentId, Guid userId)
    {
        // Check if comment exists
        var commentExists = await dbContext.Comments.AnyAsync(comment => comment.Id == commentId);

        // If the comment doesn't exist, we're sad
        if (!commentExists)
            throw new CommentNotFoundException();

        // Check if the user is the author of the comment
        var authorId = await dbContext.Comments
            .Where(comment => comment.Id == commentId)
            .Select(comment => comment.AuthorId)
            .FirstOrDefaultAsync();

        // If the user is the author, we're sad
        if (authorId == userId)
            throw new CannotLikeOwnCommentException();

        // Execute atomic toggle operation using a single SQL statement
        // This prevents race conditions by doing the entire operation atomically at the database level
        await dbContext.Database.ExecuteSqlInterpolatedAsync($@"
            WITH deleted AS (
                DELETE FROM comment_likes 
                WHERE user_id = {userId}
                  AND comment_id = {commentId}
                RETURNING *
            )
            INSERT INTO comment_likes (user_id, comment_id, created_at)
            SELECT {userId}, {commentId}, {DateTimeOffset.UtcNow}
            WHERE NOT EXISTS (SELECT 1 FROM deleted)
        ");

        // Log the toggle
        logger.LogInformation(
            "Toggled like for user {UserId} on comment {CommentId}",
            userId,
            commentId);
    }

    /// <inheritdoc />
    public async Task<ImmutableDictionary<string, int>> GetCommentCountsAsync(CommentTargetType targetType, ImmutableList<string> targetIds)
    {
        // Build the query based on the target type
        // Include only active comments
        var query = targetType switch
        {
            CommentTargetType.News => dbContext.NewsArticleComments
                .Where(newsArticleComment => targetIds.Contains(newsArticleComment.NewsArticle.ContentId))
                .Where(newsArticleComment => newsArticleComment.Comment.Status == CommentStatus.Active)
                .GroupBy(newsArticleComment => newsArticleComment.NewsArticle.ContentId)
                .Select(group => new KeyValuePair<string, int>(group.Key, group.Count())),

            CommentTargetType.Handout => dbContext.HandoutComments
                .Where(handoutComment => targetIds.Contains(handoutComment.Handout.ContentId))
                .Where(handoutComment => handoutComment.Comment.Status == CommentStatus.Active)
                .GroupBy(handoutComment => handoutComment.Handout.ContentId)
                .Select(group => new KeyValuePair<string, int>(group.Key, group.Count())),

            // Unhandled target type
            _ => throw new ArgumentException("Unsupported target type for bulk counts", nameof(targetType))
        };

        // Execute the query
        var counts = await query.ToDictionaryAsync(pair => pair.Key, pair => pair.Value);

        // Return the counts as an immutable dictionary
        return counts.ToImmutableDictionary();
    }

    #endregion

    #region Private Methods

    /// <summary>
    /// Builds a recursive CTE query for fetching comments on any target type.
    /// </summary>
    /// <param name="target">The target of the comments.</param>
    /// <returns>A tuple containing the parameterized SQL query and the parameter array.</returns>
    private static (string Sql, object[] Parameters) BuildCommentsCte(CommentTarget target)
    {
        // Define target-specific JOIN and WHERE fragments
        var (joinFragment, whereFragment) = target.TargetType switch
        {
            CommentTargetType.Handout => (
                "JOIN handout_comments hc ON c.id = hc.comment_id JOIN handouts h ON hc.handout_id = h.id",
                "h.content_id = @p0"
            ),
            CommentTargetType.Problem => (
                "JOIN problem_comments pc ON c.id = pc.comment_id JOIN problems p ON pc.problem_id = p.id",
                "p.slug = @p0"
            ),
            CommentTargetType.News => (
                "JOIN news_article_comments nc ON c.id = nc.comment_id JOIN news_articles n ON nc.news_article_id = n.id",
                "n.content_id = @p0"
            ),
            _ => throw new ArgumentOutOfRangeException(nameof(target))
        };

        // Build the SQL with the target-specific fragments
        // Note: We filter out 'superseded' (old edit versions) but keep 'deleted' (soft-deleted, shown as placeholders)
        var sql = $@"
            WITH RECURSIVE comment_tree AS (
                SELECT c.id, c.parent_comment_id, c.author_id, c.content, c.status, c.created_at, c.previous_version_id
                FROM comments c
                {joinFragment}
                WHERE {whereFragment} AND c.parent_comment_id IS NULL AND c.status != 'superseded'::comment_status
                
                UNION ALL
                
                SELECT c.id, c.parent_comment_id, c.author_id, c.content, c.status, c.created_at, c.previous_version_id
                FROM comments c
                JOIN comment_tree ct ON c.parent_comment_id = ct.id
                WHERE c.status != 'superseded'::comment_status
            )
            SELECT 
                ct.id, 
                ct.parent_comment_id, 
                u.external_id AS author_external_id, 
                u.display_name AS author_name, 
                u.avatar_url AS author_avatar_url, 
                ct.content, 
                ct.status, 
                ct.created_at, 
                ct.previous_version_id
            FROM comment_tree ct
            JOIN users u ON ct.author_id = u.id
            ORDER BY ct.created_at";

        // Return the query and the target slug as a parameter
        return (sql, [target.TargetId]);
    }

    #endregion
}

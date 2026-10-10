using MathComps.Domain.Contracts.Comments;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System.Collections.Immutable;

namespace MathComps.Infrastructure.Services.Comments;

/// <summary>
/// An <see cref="ICommentService"/> over EF Core, reading a thread with one recursive SQL query and toggling a
/// like in one statement. Who may reach a thread, and how a comment is stored in one, is up to the
/// <see cref="ICommentThreadKind"/> serving its target type.
/// </summary>
/// <param name="dbContextFactory">The factory minting a context per operation.</param>
/// <param name="kinds">Every kind of thread, exactly one per <see cref="CommentTargetType"/>.</param>
/// <param name="logger">The logger.</param>
public class CommentService(
    IDbContextFactory<MathCompsDbContext> dbContextFactory,
    IEnumerable<ICommentThreadKind> kinds,
    ILogger<CommentService> logger) : ICommentService
{
    /// <summary>
    /// Every kind of thread, in the order they were registered, which is the order a stored comment's thread is
    /// looked for in.
    /// </summary>
    private readonly ImmutableArray<ICommentThreadKind> _kinds = ValidateKinds(kinds);

    #region Private Types

    /// <summary>
    /// One comment of a thread as the tree query returns it, flat, with its author.
    /// </summary>
    /// <param name="Id"><inheritdoc cref="Comment.Id" path="/summary"/></param>
    /// <param name="ParentCommentId"><inheritdoc cref="Comment.ParentCommentId" path="/summary"/></param>
    /// <param name="AuthorExternalId"><inheritdoc cref="CommentAuthorDto.Id" path="/summary"/></param>
    /// <param name="AuthorName"><inheritdoc cref="CommentAuthorDto.Name" path="/summary"/></param>
    /// <param name="AuthorAvatarUrl"><inheritdoc cref="CommentAuthorDto.AvatarUrl" path="/summary"/></param>
    /// <param name="Content"><inheritdoc cref="Comment.Content" path="/summary"/></param>
    /// <param name="Status"><inheritdoc cref="Comment.Status" path="/summary"/></param>
    /// <param name="PostedAt"><inheritdoc cref="CommentDto.CreatedAt" path="/summary"/></param>
    /// <param name="CreatedAt">When this version was written.</param>
    /// <param name="PreviousVersionId"><inheritdoc cref="Comment.PreviousVersionId" path="/summary"/></param>
    private record CommentRow(
        Guid Id,
        Guid? ParentCommentId,
        string AuthorExternalId,
        string? AuthorName,
        string? AuthorAvatarUrl,
        string Content,
        CommentStatus Status,
        DateTimeOffset PostedAt,
        DateTimeOffset CreatedAt,
        Guid? PreviousVersionId
    );

    #endregion

    #region ICommentService Implementation

    /// <inheritdoc />
    public async Task<ImmutableList<CommentDto>> GetCommentsAsync(CommentTarget target, CommentViewer? viewer)
    {
        // A fresh context for this operation.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync();

        // Only a thread the viewer may reach is read
        await EnsureOpenAsync(dbContext, target, viewer);

        // The query reading the target's thread, replaced versions left out
        var (sql, parameters) = await BuildCommentsCteAsync(dbContext, target);

        // The thread's comments, flat, each with its author
        var flatComments = await dbContext.Database
            .SqlQueryRaw<CommentRow>(sql, parameters)
            .ToListAsync();

        // The ids of the thread's comments
        var commentIds = flatComments.Select(comment => comment.Id).ToHashSet();

        // Each thread comment's like count, by comment id
        var likeCounts = await dbContext.CommentLikes
            .Where(commentLike => commentIds.Contains(commentLike.CommentId))
            .GroupBy(commentLike => commentLike.CommentId)
            .Select(group => new { CommentId = group.Key, Count = group.Count() })
            .ToDictionaryAsync(group => group.CommentId, group => group.Count);

        // The thread comments the viewer has liked, when someone signed in is asking
        var userLikes = viewer is not null
            // The viewer's likes among the thread's comments
            ? await dbContext.CommentLikes
                .Where(commentLike => commentIds.Contains(commentLike.CommentId) && commentLike.UserId == viewer.UserId)
                .Select(commentLike => commentLike.CommentId)
                .ToHashSetAsync()
            // A signed-out caller has liked nothing
            : [];

        // Each comment's direct replies, by the parent's id
        var childrenMap = flatComments
            .Where(comment => comment.ParentCommentId != null)
            .GroupBy(comment => comment.ParentCommentId!.Value)
            .ToDictionary(group => group.Key, group => group.ToList());

        // A function building a comment with its whole reply subtree nested under it
        CommentDto BuildDto(CommentRow row)
        {
            // Get the children of the comment
            var children = childrenMap.GetValueOrDefault(row.Id, []);

            // Build chronological replies
            var replies = children
                .OrderBy(comment => comment.PostedAt)
                .Select(BuildDto)
                .ToImmutableList();

            // The comment's author
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

            // The comment as the thread shows it
            return new CommentDto(
                Id: row.Id,
                Author: author,
                Content: content,
                CreatedAt: row.PostedAt,
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
            .OrderBy(comment => comment.PostedAt)
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
    public async Task<CommentDto> CreateCommentAsync(
        CommentTarget target, CommentViewer viewer, string content, Guid? parentCommentId = null)
    {
        // A fresh context for this operation.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync();

        // Only a thread the viewer may reach is written in
        await EnsureOpenAsync(dbContext, target, viewer);

        // The author, who needs a username to sign the comment with. Read before the thread is resolved, since
        // resolving a handout's or an article's thread can mint its row, so a comment refused for its author writes
        // nothing.
        var author = await dbContext.Users
            .Where(user => user.Id == viewer.UserId && user.Username != null)
            .Select(user => new CommentAuthorDto(
                user.ExternalId, user.IsDeleted ? null : user.Username, user.AvatarUrl))
            .FirstOrDefaultAsync()
            // With no name to sign it, there is no comment to write
            ?? throw new CommentProfileIncompleteException();

        // The kind of thread the target names
        var kind = KindOf(target.TargetType);

        // The thread the target names
        var anchor = await kind.ResolveAsync(dbContext, target);

        // A reply stays in its parent's thread, since a thread pulls its replies in by their parent alone
        if (parentCommentId is { } parentId && (await ReadThreadAsync(dbContext, parentId)).Anchor != anchor)
            throw new CommentNotFoundException();

        // A deleted comment takes no replies, refused like a comment that is not there
        if (parentCommentId is not null && await dbContext.Comments
                .AnyAsync(comment => comment.Id == parentCommentId && comment.Status == CommentStatus.Deleted))
            throw new CommentNotFoundException();

        // The new comment
        var comment = new Comment
        {
            AuthorId = viewer.UserId,
            ParentCommentId = parentCommentId,
            Content = content,
            Status = CommentStatus.Active,
            CreatedAt = DateTimeOffset.UtcNow
        };

        // Add the comment to the database
        dbContext.Comments.Add(comment);

        // Hang the comment off its thread
        kind.Attach(dbContext, anchor, comment.Id);

        // Whatever else the comment owes in its kind of thread
        await kind.OnCreatedAsync(dbContext, anchor, comment);

        // Save the comment
        await dbContext.SaveChangesAsync();

        // Log the creation of the comment
        logger.LogInformation(
            "Created comment {CommentId} by user {AuthorId} on {TargetType}:{TargetId}",
            comment.Id,
            viewer.UserId,
            target.TargetType,
            target.TargetId);

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
    public async Task<UpdateCommentResult> UpdateCommentAsync(Guid commentId, CommentViewer viewer, string content)
    {
        // A fresh context for this operation.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync();

        // The thread the comment was written in and its kind, where the viewer may reach it
        var (kind, anchor) = await ReadOpenThreadAsync(dbContext, commentId, viewer);

        // Get the existing comment
        var existingComment = await dbContext.Comments.SingleAsync(comment => comment.Id == commentId);

        // Verify ownership
        if (existingComment.AuthorId != viewer.UserId)
            throw new NotCommentAuthorException();

        // A deleted comment stays deleted, refused like a comment that is not there
        if (existingComment.Status == CommentStatus.Deleted)
            throw new CommentNotFoundException();

        // Create new version
        var newComment = new Comment
        {
            AuthorId = viewer.UserId,
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

        // Link the new version into the thread the comment was written in
        kind.Attach(dbContext, anchor, newComment.Id);

        // The replies to the old version
        var replies = await dbContext.Comments
            .Where(reply => reply.ParentCommentId == existingComment.Id)
            .ToListAsync();

        // Each reply moved under the new version, since a thread skips a replaced comment and everything under it
        foreach (var reply in replies)
            reply.ParentCommentId = newComment.Id;

        // Whatever else hangs off the comment in its kind of thread follows it onto the new version
        await kind.OnEditedAsync(dbContext, existingComment.Id, newComment.Id);

        // Save all changes
        await dbContext.SaveChangesAsync();

        // Log the update
        logger.LogInformation(
            "Updated comment {OldCommentId} -> {NewCommentId} by user {UserId}",
            commentId,
            newComment.Id,
            viewer.UserId);

        // Return the new version's id and when it was written
        return new UpdateCommentResult(newComment.Id, newComment.CreatedAt);
    }

    /// <inheritdoc />
    public async Task DeleteCommentAsync(Guid commentId, CommentViewer viewer)
    {
        // A fresh context for this operation.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync();

        // Only a comment in a thread the viewer may reach is touched
        await ReadOpenThreadAsync(dbContext, commentId, viewer);

        // Get the comment
        var comment = await dbContext.Comments.SingleAsync(comment => comment.Id == commentId);

        // Verify ownership
        if (comment.AuthorId != viewer.UserId)
            throw new NotCommentAuthorException();

        // Soft-delete
        comment.Status = CommentStatus.Deleted;

        // Save all changes
        await dbContext.SaveChangesAsync();

        // Log the deletion
        logger.LogInformation(
            "Soft-deleted comment {CommentId} by user {UserId}",
            commentId,
            viewer.UserId);
    }

    /// <inheritdoc />
    public async Task ToggleLikeAsync(Guid commentId, CommentViewer viewer)
    {
        // A fresh context for this operation.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync();

        // The kind of thread the comment was written in, where the viewer may reach it
        var (kind, _) = await ReadOpenThreadAsync(dbContext, commentId, viewer);

        // A comment in a kind of thread that takes no likes is refused like a comment that is not there
        if (!kind.TakesLikes)
            throw new CommentNotFoundException();

        // The comment's author, and whether it stands
        var liked = await dbContext.Comments
            .Where(comment => comment.Id == commentId)
            .Select(comment => new { comment.AuthorId, comment.Status })
            .SingleAsync();

        // A deleted comment takes no likes, refused like a comment that is not there
        if (liked.Status == CommentStatus.Deleted)
            throw new CommentNotFoundException();

        // If the user is the author, we're sad
        if (liked.AuthorId == viewer.UserId)
            throw new CannotLikeOwnCommentException();

        // Toggle the viewer's like in one statement: delete it when there, insert it otherwise
        await dbContext.Database.ExecuteSqlInterpolatedAsync($@"
            WITH deleted AS (
                DELETE FROM comment_likes
                WHERE user_id = {viewer.UserId}
                  AND comment_id = {commentId}
                RETURNING *
            )
            INSERT INTO comment_likes (user_id, comment_id, created_at)
            SELECT {viewer.UserId}, {commentId}, {DateTimeOffset.UtcNow}
            WHERE NOT EXISTS (SELECT 1 FROM deleted)
        ");

        // Log the toggle
        logger.LogInformation(
            "Toggled like for user {UserId} on comment {CommentId}",
            viewer.UserId,
            commentId);
    }

    /// <inheritdoc />
    public async Task<ImmutableDictionary<string, int>> GetCommentCountsAsync(
        CommentTargetType targetType, ImmutableList<string> targetIds, CommentViewer? viewer)
    {
        // A fresh context for this operation.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync();

        // Each requested target's active-comment count, by its id, as its kind of thread counts it
        var query = await KindOf(targetType).CountAsync(dbContext, targetIds, viewer);

        // Each target's count, by its id
        var counts = await query.ToDictionaryAsync(pair => pair.Key, pair => pair.Value);

        // Return the counts
        return counts.ToImmutableDictionary();
    }

    #endregion

    #region Private Methods

    /// <summary>
    /// Refuses a thread the viewer may not reach as though it did not exist, so that a refusal does not confirm
    /// there is anything there.
    /// </summary>
    /// <param name="dbContext">The operation's database context.</param>
    /// <param name="target">The thread asked for.</param>
    /// <param name="viewer">Who is asking; null for a signed-out caller.</param>
    private async Task EnsureOpenAsync(MathCompsDbContext dbContext, CommentTarget target, CommentViewer? viewer)
    {
        // A thread the viewer may not reach, refused like one that is not there
        if (!await KindOf(target.TargetType).IsOpenAsync(dbContext, target, viewer))
            throw new CommentTargetNotFoundException(target.TargetType, target.TargetId);
    }

    /// <summary>
    /// Reads the thread a comment was written in, refusing a comment in a thread the viewer may not reach as
    /// though it did not exist.
    /// </summary>
    /// <param name="dbContext">The operation's database context.</param>
    /// <param name="commentId">The comment.</param>
    /// <param name="viewer">Who is asking.</param>
    /// <returns>The thread the comment belongs to, with the kind that found it.</returns>
    private async Task<(ICommentThreadKind Kind, CommentAnchor Anchor)> ReadOpenThreadAsync(
        MathCompsDbContext dbContext, Guid commentId, CommentViewer viewer)
    {
        // The thread the comment is stored in
        var thread = await ReadThreadAsync(dbContext, commentId);

        // The thread, where the viewer may reach it; refused like a comment that is not there otherwise
        return await thread.Kind.IsOpenToAsync(dbContext, thread.Anchor, viewer)
            ? thread
            : throw new CommentNotFoundException();
    }

    /// <summary>
    /// Reads the thread a comment was written in off its stored link. A version an edit has replaced counts as
    /// missing, and so does a comment in a thread nobody can reach, such as one on a problem the archive does not
    /// serve.
    /// </summary>
    /// <param name="dbContext">The operation's database context.</param>
    /// <param name="commentId">The comment.</param>
    /// <returns>The thread the comment belongs to, with the kind that found it.</returns>
    private async Task<(ICommentThreadKind Kind, CommentAnchor Anchor)> ReadThreadAsync(
        MathCompsDbContext dbContext, Guid commentId)
    {
        // Whether the comment is there, as a version no edit has replaced
        var isLive = await dbContext.Comments
            .AnyAsync(comment => comment.Id == commentId && comment.Status != CommentStatus.Superseded);

        // A missing or replaced comment is refused as not found
        if (!isLive)
            throw new CommentNotFoundException();

        // Each kind asked in turn for the thread the comment hangs off, since it hangs off exactly one
        foreach (var kind in _kinds)
        {
            // The kind's thread, where the comment hangs off one
            if (await kind.FindAsync(dbContext, commentId) is { } anchor)
                return (kind, anchor);
        }

        // A comment in no thread anybody can reach is refused as not found
        throw new CommentNotFoundException();
    }

    /// <summary>
    /// Builds a recursive CTE query for fetching comments on any target type.
    /// </summary>
    /// <param name="dbContext">The operation's database context.</param>
    /// <param name="target">The target of the comments.</param>
    /// <returns>The thread's SQL and the values it binds.</returns>
    private async Task<(string Sql, object[] Parameters)> BuildCommentsCteAsync(
        MathCompsDbContext dbContext, CommentTarget target)
    {
        // The JOIN and WHERE picking out the target's thread, with the values the WHERE compares against
        var (joinFragment, whereFragment, parameters) =
            await KindOf(target.TargetType).SelectAsync(dbContext, target);

        // The thread's SQL, which skips a replaced version and keeps a deleted comment so the replies under it
        // stay reachable. Each comment is walked back through its earlier versions to the first one, whose time
        // is when the comment was posted.
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
            ),
            comment_versions AS (
                SELECT ct.id AS comment_id, ct.previous_version_id, ct.created_at
                FROM comment_tree ct

                UNION ALL

                SELECT cv.comment_id, v.previous_version_id, v.created_at
                FROM comment_versions cv
                JOIN comments v ON v.id = cv.previous_version_id
            )
            SELECT
                ct.id,
                ct.parent_comment_id,
                u.external_id AS author_external_id,
                CASE WHEN u.is_deleted THEN NULL ELSE u.username END AS author_name,
                u.avatar_url AS author_avatar_url,
                ct.content,
                ct.status,
                first_version.created_at AS posted_at,
                ct.created_at,
                ct.previous_version_id
            FROM comment_tree ct
            JOIN comment_versions first_version
                ON first_version.comment_id = ct.id AND first_version.previous_version_id IS NULL
            JOIN users u ON ct.author_id = u.id
            ORDER BY first_version.created_at";

        // Return the query and the values its fragments compare against
        return (sql, parameters);
    }

    /// <summary>
    /// The kind of thread a target type names.
    /// </summary>
    /// <param name="targetType">The target type.</param>
    /// <returns>The kind serving it.</returns>
    private ICommentThreadKind KindOf(CommentTargetType targetType) =>
        // Every target type has its kind, so only a value outside the enum goes without one
        _kinds.FirstOrDefault(kind => kind.TargetType == targetType)
        ?? throw new ArgumentOutOfRangeException(nameof(targetType), targetType, "Invalid comment target type");

    /// <summary>
    /// Takes the kinds of thread, refusing a set that leaves a target type without a kind or gives it two, so no
    /// thread is ever served without its own access rule.
    /// </summary>
    /// <param name="threadKinds">Every kind of thread.</param>
    /// <returns>The kinds, in the order given.</returns>
    /// <exception cref="InvalidOperationException">Thrown when a target type has no kind or more than one.</exception>
    private static ImmutableArray<ICommentThreadKind> ValidateKinds(IEnumerable<ICommentThreadKind> threadKinds)
    {
        // The kinds, in the order given
        var allKinds = threadKinds.ToImmutableArray();

        // Every target type served by anything other than exactly one kind
        var misserved = Enum.GetValues<CommentTargetType>()
            .Where(targetType => allKinds.Count(kind => kind.TargetType == targetType) != 1)
            .ToList();

        // A type with no kind, or with two, is a wiring mistake, refused before it serves a single thread
        if (misserved.Count > 0)
            throw new InvalidOperationException(
                $"Each comment target type needs exactly one thread kind: {string.Join(", ", misserved)}");

        // The kinds, each type served once
        return allKinds;
    }

    #endregion
}

using MathComps.Domain.Contracts.Comments;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using System.Collections.Immutable;

namespace MathComps.Infrastructure.Services.Comments;

/// <summary>
/// An <see cref="ICommentSeenService"/> over EF Core. When somebody else last posted in a thread is read with one
/// recursive SQL query walking each standing comment back to its first version, whose time is when it was posted.
/// Who may reach a thread is up to the <see cref="ICommentThreadKind"/> serving its target type.
/// </summary>
/// <param name="dbContextFactory">The factory minting a context per operation.</param>
/// <param name="kinds">Every kind of thread.</param>
public class CommentSeenService(
    IDbContextFactory<MathCompsDbContext> dbContextFactory,
    IEnumerable<ICommentThreadKind> kinds) : ICommentSeenService
{
    #region Private Types

    /// <summary>
    /// One standing comment somebody other than the reader posted, as the posting query returns it.
    /// </summary>
    /// <param name="CommentId">The id of the comment's current version.</param>
    /// <param name="PostedAt"><inheritdoc cref="CommentDto.CreatedAt" path="/summary"/></param>
    private sealed record PostedComment(Guid CommentId, DateTimeOffset PostedAt);

    #endregion

    #region ICommentSeenService Implementation

    /// <inheritdoc />
    public async Task<ImmutableDictionary<string, CommentThreadSeenDto>> GetSeenAsync(
        CommentTargetType targetType,
        ImmutableList<string> targetIds,
        CommentViewer viewer,
        CancellationToken cancellationToken = default)
    {
        // A fresh context for this operation.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // The kind serving the threads, refused like a missing target when none does
        var kind = kinds.FirstOrDefault(candidate => candidate.TargetType == targetType)
                   ?? throw new CommentTargetNotFoundException(targetType, string.Join(", ", targetIds));

        // Every comment of the threads asked for, linked to its thread, refused when the viewer may not reach them
        var linksQuery = await kind.LinksAsync(dbContext, targetIds, viewer);

        // The target each linked comment hangs off, by the comment's id
        var targetOf = await linksQuery.ToDictionaryAsync(link => link.Value, link => link.Key, cancellationToken);

        // When each standing comment somebody else posted in the threads was posted
        var posted = await ReadPostedByOthersAsync(dbContext, [.. targetOf.Keys], viewer.UserId, cancellationToken);

        // When somebody else last posted in each thread, by its target id
        var lastPostedAt = posted
            .GroupBy(comment => targetOf[comment.CommentId])
            .ToDictionary(group => group.Key, group => group.Max(comment => comment.PostedAt));

        // How far the viewer has seen each of the threads, by its target id
        var seenUpTo = await dbContext.CommentSeenMarks
            .AsNoTracking()
            .Where(mark => mark.UserId == viewer.UserId
                           && mark.TargetType == targetType
                           && targetIds.Contains(mark.TargetId))
            .ToDictionaryAsync(mark => mark.TargetId, mark => mark.SeenUpTo, cancellationToken);

        // Every thread asked for, with how far it is seen and when somebody else last posted in it
        return targetIds
            .Distinct()
            .ToImmutableDictionary(
                targetId => targetId,
                targetId => new CommentThreadSeenDto(
                    seenUpTo.TryGetValue(targetId, out var seen) ? seen : null,
                    lastPostedAt.TryGetValue(targetId, out var last) ? last : null));
    }

    /// <inheritdoc />
    public async Task MarkSeenAsync(
        CommentTargetType targetType,
        ImmutableList<string> targetIds,
        CommentViewer viewer,
        DateTimeOffset seenUpTo,
        CancellationToken cancellationToken = default)
    {
        // No thread named, nothing to mark
        if (targetIds.IsEmpty)
            return;

        // A fresh context for this operation.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // Each thread marked as seen up to the moment, a mark already further along left where it is
        await dbContext.CommentSeenMarks
            .UpsertRange(targetIds.Select(targetId => new CommentSeenMark
            {
                UserId = viewer.UserId,
                TargetType = targetType,
                TargetId = targetId,
                SeenUpTo = seenUpTo,
            }))
            .On(mark => new { mark.UserId, mark.TargetType, mark.TargetId })
            .UpdateIf((stored, marked) => stored.SeenUpTo < marked.SeenUpTo)
            .RunAsync(cancellationToken);
    }

    #endregion

    #region Private Methods

    /// <summary>
    /// Reads, among some comments, the versions no edit has replaced and nobody has deleted that somebody other than
    /// the reader posted, each with when it was first posted.
    /// </summary>
    /// <param name="dbContext">The operation's database context.</param>
    /// <param name="commentIds">The comments, any of their versions.</param>
    /// <param name="readerId">The reader, whose own comments are left out.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>The standing comments somebody else posted, each with its posting time.</returns>
    private static Task<List<PostedComment>> ReadPostedByOthersAsync(
        MathCompsDbContext dbContext,
        Guid[] commentIds,
        Guid readerId,
        CancellationToken cancellationToken)
    {
        // Each standing comment walked back through its earlier versions to the first one, whose time is when the
        // comment was posted
        const string sql = @"
            WITH RECURSIVE comment_versions AS (
                SELECT c.id AS comment_id, c.previous_version_id, c.created_at
                FROM comments c
                WHERE c.id = ANY(@p0) AND c.status = 'active'::comment_status AND c.author_id <> @p1

                UNION ALL

                SELECT cv.comment_id, v.previous_version_id, v.created_at
                FROM comment_versions cv
                JOIN comments v ON v.id = cv.previous_version_id
            )
            SELECT comment_id, created_at AS posted_at
            FROM comment_versions
            WHERE previous_version_id IS NULL";

        // The values the query compares against, in order
        object[] parameters = [commentIds, readerId];

        // The comments, with when each was posted
        return dbContext.Database
            .SqlQueryRaw<PostedComment>(sql, parameters)
            .ToListAsync(cancellationToken);
    }

    #endregion
}

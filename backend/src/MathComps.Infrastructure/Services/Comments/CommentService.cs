using MathComps.Domain.Contracts.Comments;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Competitions;
using MathComps.Infrastructure.Services.GradeMessages;
using MathComps.Infrastructure.Services.Users;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System.Collections.Immutable;

namespace MathComps.Infrastructure.Services.Comments;

/// <summary>
/// An <see cref="ICommentService"/> over EF Core, reading a thread with one recursive SQL query and toggling a
/// like in one statement.
/// </summary>
/// <param name="dbContextFactory">The factory minting a context per operation.</param>
/// <param name="grants"><inheritdoc cref="IUserGrantService" path="/summary"/></param>
/// <param name="logger">The logger.</param>
public class CommentService(
    IDbContextFactory<MathCompsDbContext> dbContextFactory,
    IUserGrantService grants,
    ILogger<CommentService> logger) : ICommentService
{
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

    /// <summary>
    /// The thread a comment belongs to, by the ids its link points at.
    /// </summary>
    /// <param name="TargetType">The kind of thread.</param>
    private abstract record CommentAnchor(CommentTargetType TargetType);

    /// <summary>
    /// A problem's thread.
    /// </summary>
    /// <param name="ProblemId"><inheritdoc cref="ProblemComment.ProblemId" path="/summary"/></param>
    private sealed record ProblemAnchor(Guid ProblemId) : CommentAnchor(CommentTargetType.Problem);

    /// <summary>
    /// A handout's thread.
    /// </summary>
    /// <param name="HandoutId"><inheritdoc cref="HandoutComment.HandoutId" path="/summary"/></param>
    private sealed record HandoutAnchor(Guid HandoutId) : CommentAnchor(CommentTargetType.Handout);

    /// <summary>
    /// A news article's thread.
    /// </summary>
    /// <param name="NewsArticleId"><inheritdoc cref="NewsArticleComment.NewsArticleId" path="/summary"/></param>
    private sealed record NewsAnchor(Guid NewsArticleId) : CommentAnchor(CommentTargetType.News);

    /// <summary>
    /// The conversation between the graders and one student about one problem the student was graded on.
    /// </summary>
    /// <param name="EntryId"><inheritdoc cref="HostedGradeComment.EntryId" path="/summary"/></param>
    /// <param name="ProblemId"><inheritdoc cref="HostedGradeComment.ProblemId" path="/summary"/></param>
    /// <param name="StudentId">The student the conversation is with.</param>
    private sealed record GradeAnchor(Guid EntryId, Guid ProblemId, Guid StudentId)
        : CommentAnchor(CommentTargetType.HostedGrade);

    /// <summary>
    /// The reviewers' discussion of a proposal.
    /// </summary>
    /// <param name="ProposalId"><inheritdoc cref="ProposalComment.ProposalId" path="/summary"/></param>
    private sealed record ProposalAnchor(Guid ProposalId) : CommentAnchor(CommentTargetType.Proposal);

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
        // resolving a handout's or an article's thread can mint its row, so a refused comment writes nothing.
        var author = await dbContext.Users
            .Where(user => user.Id == viewer.UserId && user.Username != null)
            .Select(user => new CommentAuthorDto(
                user.ExternalId, user.IsDeleted ? null : user.Username, user.AvatarUrl))
            .FirstOrDefaultAsync()
            // With no name to sign it, there is no comment to write
            ?? throw new CommentProfileIncompleteException();

        // The thread the target names
        var anchor = await ResolveAnchorAsync(dbContext, target);

        // A reply stays in its parent's thread, since a thread pulls its replies in by their parent alone
        if (parentCommentId is { } parentId && await ReadAnchorAsync(dbContext, parentId) != anchor)
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
        Attach(dbContext, anchor, comment.Id);

        // A message in a grade conversation is owed to the other side of it by mail
        if (anchor is GradeAnchor grade)
            await GradeMessageNotices.QueueAsync(
                dbContext, grade.EntryId, grade.ProblemId, grade.StudentId, comment, CancellationToken.None);

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

        // The thread the comment was written in, where the viewer may reach it
        var anchor = await ReadOpenAnchorAsync(dbContext, commentId, viewer);

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
        Attach(dbContext, anchor, newComment.Id);

        // The replies to the old version
        var replies = await dbContext.Comments
            .Where(reply => reply.ParentCommentId == existingComment.Id)
            .ToListAsync();

        // Each reply moved under the new version, since a thread skips a replaced comment and everything under it
        foreach (var reply in replies)
            reply.ParentCommentId = newComment.Id;

        // In a grade conversation, the message's notices follow it, since the mail reads whichever version is current
        if (anchor is GradeAnchor)
        {
            // The old version's notices
            var notices = await dbContext.GradeMessageNotices
                .Where(notice => notice.CommentId == existingComment.Id)
                .ToListAsync();

            // Each notice moved onto the new version
            foreach (var notice in notices)
                notice.CommentId = newComment.Id;
        }

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
        await ReadOpenAnchorAsync(dbContext, commentId, viewer);

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

        // Only a comment in a thread the viewer may reach is liked
        var anchor = await ReadOpenAnchorAsync(dbContext, commentId, viewer);

        // A grade conversation and a proposal's discussion take no likes, refused like a comment that is not there
        if (anchor is GradeAnchor or ProposalAnchor)
            throw new CommentNotFoundException();

        // The comment's author
        var authorId = await dbContext.Comments
            .Where(comment => comment.Id == commentId)
            .Select(comment => comment.AuthorId)
            .SingleAsync();

        // If the user is the author, we're sad
        if (authorId == viewer.UserId)
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

        // Each requested target's active-comment count, by its id
        var query = targetType switch
        {
            // Each article's active comments
            CommentTargetType.News => dbContext.NewsArticleComments
                .Where(newsArticleComment => targetIds.Contains(newsArticleComment.NewsArticle.ContentId))
                .Where(newsArticleComment => newsArticleComment.Comment.Status == CommentStatus.Active)
                .GroupBy(newsArticleComment => newsArticleComment.NewsArticle.ContentId)
                .Select(group => new KeyValuePair<string, int>(group.Key, group.Count())),

            // Each handout's active comments
            CommentTargetType.Handout => dbContext.HandoutComments
                .Where(handoutComment => targetIds.Contains(handoutComment.Handout.ContentId))
                .Where(handoutComment => handoutComment.Comment.Status == CommentStatus.Active)
                .GroupBy(handoutComment => handoutComment.Handout.ContentId)
                .Select(group => new KeyValuePair<string, int>(group.Key, group.Count())),

            // Each live proposal's active comments, counted for the accounts preparing the competitions alone and
            // refused like targets that are not there to anybody else
            CommentTargetType.Proposal => await IsPreparingCompetitionsAsync(viewer)
                ? ProposalCounts(dbContext, targetIds)
                : throw new CommentTargetNotFoundException(targetType, string.Join(", ", targetIds)),

            // A problem's thread, with no bulk count
            CommentTargetType.Problem
                => throw new ArgumentException("Unsupported target type for bulk counts", nameof(targetType)),

            // Grade conversations, each closed to all but admins and its student, refused like targets that are
            // not there
            CommentTargetType.HostedGrade
                => throw new CommentTargetNotFoundException(targetType, string.Join(", ", targetIds)),

            // Unhandled target type
            _ => throw new ArgumentOutOfRangeException(nameof(targetType), targetType, "Invalid comment target type")
        };

        // Each target's count, by its id
        var counts = await query.ToDictionaryAsync(pair => pair.Key, pair => pair.Value);

        // Return the counts
        return counts.ToImmutableDictionary();
    }

    #endregion

    #region Private Methods

    /// <summary>
    /// Resolves the thread a target names, minting the anchor of file-based content the first time anything is
    /// attached to it.
    /// </summary>
    /// <param name="dbContext">The operation's database context.</param>
    /// <param name="target">The thread's target.</param>
    /// <returns>The thread the target names.</returns>
    private async Task<CommentAnchor> ResolveAnchorAsync(MathCompsDbContext dbContext, CommentTarget target) =>
        // The thread the target names, per kind of target
        target.TargetType switch
        {
            // The row standing in for the handout, minted now if nothing has hung off it yet
            CommentTargetType.Handout => new HandoutAnchor(
                await ContentAnchors.EnsureHandoutAsync(dbContext, target.TargetId)),

            // The row standing in for the article, minted now if nothing has hung off it yet
            CommentTargetType.News => new NewsAnchor(
                await ContentAnchors.EnsureNewsArticleAsync(dbContext, target.TargetId)),

            // The problem with the slug, which the archive must serve
            CommentTargetType.Problem => await ResolveProblemAnchorAsync(dbContext, target),

            // The grade conversation, by the student's entry and the problem
            CommentTargetType.HostedGrade => await ResolveGradeAnchorAsync(dbContext, target),

            // The proposal's discussion, while the proposal stands
            CommentTargetType.Proposal => await ResolveProposalAnchorAsync(dbContext, target),

            // Unhandled target type
            _ => throw new ArgumentOutOfRangeException(nameof(target), target.TargetType, "Invalid comment target type")
        };

    /// <summary>
    /// Resolves a problem's thread by the problem's slug. Only a problem the archive serves, by
    /// <see cref="ProblemQueryableExtensions.WhereArchiveServes"/>, has a thread, and any other is refused like a
    /// missing one.
    /// </summary>
    /// <param name="dbContext">The operation's database context.</param>
    /// <param name="target">The thread, identified by the problem's slug.</param>
    /// <returns>The problem's thread.</returns>
    private static async Task<ProblemAnchor> ResolveProblemAnchorAsync(
        MathCompsDbContext dbContext, CommentTarget target) =>
        // The served problem with the slug, refused like a missing thread when there is none
        new(await dbContext.Problems
                .WhereArchiveServes(DateTimeOffset.UtcNow)
                .Where(problem => problem.Slug == target.TargetId)
                .Select(problem => (Guid?)problem.Id)
                .FirstOrDefaultAsync()
            ?? throw new CommentTargetNotFoundException(target.TargetType, target.TargetId));

    /// <summary>
    /// Resolves a grade conversation, named like the grade itself by its problem and student, to the problem and
    /// the student's graded entry, found by <see cref="HostedGrading.FindGradableEntryAsync"/>.
    /// </summary>
    /// <param name="dbContext">The operation's database context.</param>
    /// <param name="target">The conversation, identified as <c>{problemId}:{userId}</c>.</param>
    /// <returns>The conversation.</returns>
    private async Task<GradeAnchor> ResolveGradeAnchorAsync(MathCompsDbContext dbContext, CommentTarget target)
    {
        // The problem and the student, refused like a missing thread when the id doesn't name them
        if (!HostedGrading.TryParseConversationTargetId(target.TargetId, out var problemId, out var userId))
            throw new CommentTargetNotFoundException(target.TargetType, target.TargetId);

        // The entry the student is graded under, refused like a missing thread where there is nothing to grade
        var entry = await HostedGrading.FindGradableEntryAsync(
                dbContext, grants, problemId, userId, CancellationToken.None)
            ?? throw new CommentTargetNotFoundException(target.TargetType, target.TargetId);

        // The conversation with the student about the problem
        return new GradeAnchor(entry.Id, problemId, userId);
    }

    /// <summary>
    /// Resolves a proposal's discussion, named by the proposal's id, to a proposal that has not been deleted. A
    /// deleted proposal's discussion goes with it.
    /// </summary>
    /// <param name="dbContext">The operation's database context.</param>
    /// <param name="target">The discussion, identified by the proposal's id.</param>
    /// <returns>The discussion.</returns>
    private static async Task<ProposalAnchor> ResolveProposalAnchorAsync(
        MathCompsDbContext dbContext, CommentTarget target)
    {
        // An id that is no GUID names no proposal, refused like a missing thread
        if (!Guid.TryParse(target.TargetId, out var proposalId))
            throw new CommentTargetNotFoundException(target.TargetType, target.TargetId);

        // Whether the proposal stands
        var stands = await dbContext.Proposals
            .AnyAsync(proposal => proposal.ProblemId == proposalId && proposal.DeletedAt == null);

        // The proposal's discussion, or a missing thread when no standing proposal has the id
        return stands ? new ProposalAnchor(proposalId) : throw new CommentTargetNotFoundException(
            target.TargetType, target.TargetId);
    }

    /// <summary>
    /// Reads the thread a comment was written in, refusing a comment in a thread the viewer may not reach as
    /// though it did not exist.
    /// </summary>
    /// <param name="dbContext">The operation's database context.</param>
    /// <param name="commentId">The comment.</param>
    /// <param name="viewer">Who is asking.</param>
    /// <returns>The thread the comment belongs to.</returns>
    private async Task<CommentAnchor> ReadOpenAnchorAsync(
        MathCompsDbContext dbContext, Guid commentId, CommentViewer viewer)
    {
        // The thread the comment is stored in
        var anchor = await ReadAnchorAsync(dbContext, commentId);

        // The thread, where the viewer may reach it; refused like a comment that is not there otherwise
        return await IsOpenToAsync(dbContext, anchor, viewer) ? anchor : throw new CommentNotFoundException();
    }

    /// <summary>
    /// Reads the thread a comment was written in off its stored link. A version an edit has replaced counts as
    /// missing. So does a comment on a problem the archive does not serve, which has no thread, and one in a
    /// deleted proposal's discussion.
    /// </summary>
    /// <param name="dbContext">The operation's database context.</param>
    /// <param name="commentId">The comment.</param>
    /// <returns>The thread the comment belongs to.</returns>
    private static async Task<CommentAnchor> ReadAnchorAsync(MathCompsDbContext dbContext, Guid commentId)
    {
        // The problems the archive serves, the only ones with a thread
        var servedProblems = dbContext.Problems.WhereArchiveServes(DateTimeOffset.UtcNow);

        // The live comment's link into each kind of thread, of which it has exactly one
        var links = await dbContext.Comments
            .Where(comment => comment.Id == commentId && comment.Status != CommentStatus.Superseded)
            .Select(comment => new
            {
                ProblemId = dbContext.ProblemComments
                    .Where(link => link.CommentId == comment.Id
                        && servedProblems.Any(problem => problem.Id == link.ProblemId))
                    .Select(link => (Guid?)link.ProblemId)
                    .FirstOrDefault(),
                HandoutId = dbContext.HandoutComments
                    .Where(link => link.CommentId == comment.Id)
                    .Select(link => (Guid?)link.HandoutId)
                    .FirstOrDefault(),
                NewsArticleId = dbContext.NewsArticleComments
                    .Where(link => link.CommentId == comment.Id)
                    .Select(link => (Guid?)link.NewsArticleId)
                    .FirstOrDefault(),
                Grade = dbContext.HostedGradeComments
                    .Where(link => link.CommentId == comment.Id)
                    .Select(link => new { link.EntryId, link.ProblemId, link.Entry.UserId })
                    .FirstOrDefault(),
                ProposalId = dbContext.ProposalComments
                    .Where(link => link.CommentId == comment.Id && link.Proposal.DeletedAt == null)
                    .Select(link => (Guid?)link.ProposalId)
                    .FirstOrDefault(),
            })
            .FirstOrDefaultAsync()
            // A missing or replaced comment is refused as not found
            ?? throw new CommentNotFoundException();

        // The thread the comment's link points into
        return links switch
        {
            // A problem's thread
            { ProblemId: { } problemId } => new ProblemAnchor(problemId),

            // A handout's thread
            { HandoutId: { } handoutId } => new HandoutAnchor(handoutId),

            // A news article's thread
            { NewsArticleId: { } newsArticleId } => new NewsAnchor(newsArticleId),

            // A grade conversation
            { Grade: { } grade } => new GradeAnchor(grade.EntryId, grade.ProblemId, grade.UserId),

            // A proposal's discussion
            { ProposalId: { } proposalId } => new ProposalAnchor(proposalId),

            // A comment in no thread, or on a problem the archive does not serve, is one nobody can reach
            _ => throw new CommentNotFoundException()
        };
    }

    /// <summary>
    /// Links a comment into its thread.
    /// </summary>
    /// <param name="dbContext">The operation's database context.</param>
    /// <param name="anchor">The thread.</param>
    /// <param name="commentId">The comment.</param>
    private static void Attach(MathCompsDbContext dbContext, CommentAnchor anchor, Guid commentId)
    {
        // A link from the comment into its kind of thread
        switch (anchor)
        {
            // A problem's thread
            case ProblemAnchor problem:
                dbContext.ProblemComments.Add(new ProblemComment
                {
                    ProblemId = problem.ProblemId,
                    CommentId = commentId
                });
                break;

            // A handout's thread
            case HandoutAnchor handout:
                dbContext.HandoutComments.Add(new HandoutComment
                {
                    HandoutId = handout.HandoutId,
                    CommentId = commentId
                });
                break;

            // A news article's thread
            case NewsAnchor news:
                dbContext.NewsArticleComments.Add(new NewsArticleComment
                {
                    NewsArticleId = news.NewsArticleId,
                    CommentId = commentId
                });
                break;

            // A grade conversation
            case GradeAnchor grade:
                dbContext.HostedGradeComments.Add(new HostedGradeComment
                {
                    EntryId = grade.EntryId,
                    ProblemId = grade.ProblemId,
                    CommentId = commentId
                });
                break;

            // A proposal's discussion
            case ProposalAnchor proposal:
                dbContext.ProposalComments.Add(new ProposalComment
                {
                    ProposalId = proposal.ProposalId,
                    CommentId = commentId
                });
                break;

            // Unhandled anchor
            default:
                throw new ArgumentOutOfRangeException(nameof(anchor), anchor, "Invalid comment anchor");
        }
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
        // Define target-specific JOIN and WHERE fragments, with the values the WHERE compares against
        var (joinFragment, whereFragment, parameters) = target.TargetType switch
        {
            // A handout's thread, by its content id
            CommentTargetType.Handout => (
                "JOIN handout_comments hc ON c.id = hc.comment_id JOIN handouts h ON hc.handout_id = h.id",
                "h.content_id = @p0",
                new object[] { target.TargetId }
            ),

            // A problem's thread, by the problem its slug resolves to
            CommentTargetType.Problem => (
                "JOIN problem_comments pc ON c.id = pc.comment_id",
                "pc.problem_id = @p0",
                [(await ResolveProblemAnchorAsync(dbContext, target)).ProblemId]
            ),

            // A news article's thread, by its content id
            CommentTargetType.News => (
                "JOIN news_article_comments nc ON c.id = nc.comment_id "
                + "JOIN news_articles n ON nc.news_article_id = n.id",
                "n.content_id = @p0",
                [target.TargetId]
            ),

            // A grade conversation, by the entry and the problem it resolves to
            CommentTargetType.HostedGrade => GradeThreadFragments(await ResolveGradeAnchorAsync(dbContext, target)),

            // A proposal's discussion, while the proposal stands
            CommentTargetType.Proposal => ProposalThreadFragments(
                await ResolveProposalAnchorAsync(dbContext, target)),

            // Unhandled target type
            _ => throw new ArgumentOutOfRangeException(nameof(target), target.TargetType, "Invalid comment target type")
        };

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
    /// Whether a kind of thread is open to anybody.
    /// </summary>
    /// <param name="targetType">The kind of thread.</param>
    /// <returns>Whether anybody may read and write in it.</returns>
    private static bool IsPublic(CommentTargetType targetType) =>
        // Whether the kind is open to anybody
        targetType switch
        {
            // Public content
            CommentTargetType.Problem or CommentTargetType.Handout or CommentTargetType.News => true,

            // A conversation between the graders and one student
            CommentTargetType.HostedGrade => false,

            // A discussion among the accounts preparing the competitions
            CommentTargetType.Proposal => false,

            // Unhandled target type
            _ => throw new ArgumentOutOfRangeException(nameof(targetType), targetType, "Invalid comment target type")
        };

    /// <summary>
    /// Whether a viewer is somebody a grade conversation is between: an admin, or the student it is with.
    /// </summary>
    /// <param name="viewer">Who is asking; null for a signed-out caller.</param>
    /// <param name="studentId">The student the conversation is with.</param>
    /// <returns>Whether the conversation is between them and the graders.</returns>
    private static bool IsBetween(CommentViewer? viewer, Guid studentId) =>
        // Any admin, or the student themselves
        viewer is { IsAdmin: true } || viewer?.UserId == studentId;

    /// <summary>
    /// Whether a viewer is one of the accounts preparing the competitions.
    /// </summary>
    /// <param name="viewer">Who is asking; null for a signed-out caller.</param>
    /// <returns>Whether they prepare the competitions.</returns>
    private async Task<bool> IsPreparingCompetitionsAsync(CommentViewer? viewer) =>
        // A signed-in account holding the PrepareCompetitions grant
        viewer is not null && await grants.HasAsync(viewer.UserId, UserCapability.PrepareCompetitions);

    /// <summary>
    /// Whether a viewer may read and write in a thread whose anchor is known.
    /// </summary>
    /// <param name="dbContext">The operation's database context.</param>
    /// <param name="anchor">The thread.</param>
    /// <param name="viewer">Who is asking; null for a signed-out caller.</param>
    /// <returns>Whether the thread is open to them.</returns>
    private async Task<bool> IsOpenToAsync(
        MathCompsDbContext dbContext, CommentAnchor anchor, CommentViewer? viewer) =>
        // Public content, open to anybody; a grade conversation, open to admins, and to its student once their group
        // has closed, while the grade is final; a proposal's discussion, open to the accounts preparing the
        // competitions
        IsPublic(anchor.TargetType)
        || (anchor is GradeAnchor grade
            && IsBetween(viewer, grade.StudentId)
            && (viewer is { IsAdmin: true }
                || await HostedGrading.IsOutToStudentAsync(
                    dbContext, grade.EntryId, grade.ProblemId, DateTimeOffset.UtcNow, CancellationToken.None)))
        || (anchor is ProposalAnchor && await IsPreparingCompetitionsAsync(viewer));

    /// <summary>
    /// Refuses a thread the viewer may not reach as though it did not exist, so that a refusal does not confirm
    /// there is anything there.
    /// </summary>
    /// <param name="dbContext">The operation's database context.</param>
    /// <param name="target">The thread asked for.</param>
    /// <param name="viewer">Who is asking; null for a signed-out caller.</param>
    private async Task EnsureOpenAsync(MathCompsDbContext dbContext, CommentTarget target, CommentViewer? viewer)
    {
        // Public content, open to anybody, so no thread is resolved to decide it. A grade conversation is looked up
        // only for somebody it is between, so not even how long a refusal takes tells anybody else whether there is
        // one. A proposal's discussion is open to the accounts preparing the competitions, whichever proposal it is.
        var isOpen = IsPublic(target.TargetType)
            || (target.TargetType == CommentTargetType.Proposal && await IsPreparingCompetitionsAsync(viewer))
            || (target.TargetType == CommentTargetType.HostedGrade
                && HostedGrading.TryParseConversationTargetId(target.TargetId, out _, out var studentId)
                && IsBetween(viewer, studentId)
                && await IsOpenToAsync(dbContext, await ResolveGradeAnchorAsync(dbContext, target), viewer));

        // A thread the viewer may not reach, refused like one that is not there
        if (!isOpen)
            throw new CommentTargetNotFoundException(target.TargetType, target.TargetId);
    }

    /// <summary>
    /// The JOIN and WHERE picking out one grade conversation's comments.
    /// </summary>
    /// <param name="anchor">The conversation.</param>
    /// <returns>The JOIN and WHERE fragments, with the values the WHERE compares against.</returns>
    private static (string Join, string Where, object[] Parameters) GradeThreadFragments(GradeAnchor anchor) =>
        // The conversation's links, matched on both of its keys
        (
            "JOIN hosted_grade_comments gc ON c.id = gc.comment_id",
            "gc.entry_id = @p0 AND gc.problem_id = @p1",
            [anchor.EntryId, anchor.ProblemId]
        );

    /// <summary>
    /// The JOIN and WHERE picking out one proposal's discussion.
    /// </summary>
    /// <param name="anchor">The discussion.</param>
    /// <returns>The JOIN and WHERE fragments, with the value the WHERE compares against.</returns>
    private static (string Join, string Where, object[] Parameters) ProposalThreadFragments(
        ProposalAnchor anchor) =>
        // The discussion's links, matched on the proposal
        (
            "JOIN proposal_comments prc ON c.id = prc.comment_id",
            "prc.proposal_id = @p0",
            [anchor.ProposalId]
        );

    /// <summary>
    /// The query counting the active comments in each discussion of a proposal that has not been deleted.
    /// </summary>
    /// <param name="dbContext">The operation's database context.</param>
    /// <param name="targetIds">The proposals, by id, where an id that doesn't parse names none.</param>
    /// <returns>The query, each discussed proposal's count keyed by its id.</returns>
    private static IQueryable<KeyValuePair<string, int>> ProposalCounts(
        MathCompsDbContext dbContext, ImmutableList<string> targetIds)
    {
        // The ids naming a proposal at all
        var proposalIds = targetIds
            .Select(targetId => Guid.TryParse(targetId, out var proposalId) ? proposalId : (Guid?)null)
            .OfType<Guid>()
            .ToList();

        // Each standing proposal's active comments, keyed by its id
        return dbContext.ProposalComments
            .Where(link => proposalIds.Contains(link.ProposalId) && link.Proposal.DeletedAt == null)
            .Where(link => link.Comment.Status == CommentStatus.Active)
            .GroupBy(link => link.ProposalId)
            .Select(group => new KeyValuePair<string, int>(group.Key.ToString(), group.Count()));
    }

    #endregion
}

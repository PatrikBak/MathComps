using MathComps.Domain.Contracts.Comments;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Competitions;
using MathComps.Infrastructure.Services.GradeMessages;
using MathComps.Infrastructure.Services.Users;
using Microsoft.EntityFrameworkCore;
using System.Collections.Immutable;

namespace MathComps.Infrastructure.Services.Comments.Kinds;

/// <summary>
/// The conversation between the graders and one student about one problem the student was graded on.
/// </summary>
/// <param name="EntryId"><inheritdoc cref="HostedGradeComment.EntryId" path="/summary"/></param>
/// <param name="ProblemId"><inheritdoc cref="HostedGradeComment.ProblemId" path="/summary"/></param>
/// <param name="StudentId">The student the conversation is with.</param>
public sealed record GradeAnchor(Guid EntryId, Guid ProblemId, Guid StudentId) : CommentAnchor;

/// <summary>
/// The grade conversations, named like the grade itself by its problem and student as <c>{problemId}:{userId}</c>.
/// One is open to admins, and to its student while the grade is final and their group has closed. A new message
/// is owed to the other side of the conversation by mail.
/// </summary>
/// <param name="grants"><inheritdoc cref="IUserGrantService" path="/summary"/></param>
public class HostedGradeThreadKind(IUserGrantService grants) : CommentThreadKind<GradeAnchor>
{
    /// <inheritdoc />
    public override CommentTargetType TargetType => CommentTargetType.HostedGrade;

    /// <inheritdoc />
    public override bool TakesLikes => false;

    /// <inheritdoc />
    public override async Task<bool> IsOpenAsync(
        MathCompsDbContext dbContext, CommentTarget target, CommentViewer? viewer) =>
        // Looked up only for somebody the conversation is between, so not even how long a refusal takes tells
        // anybody else whether there is one
        HostedGrading.TryParseConversationTargetId(target.TargetId, out _, out var studentId)
        && IsBetween(viewer, studentId)
        && await IsOpenToAsync(dbContext, await ResolveAsync(dbContext, target), viewer);

    /// <inheritdoc />
    public override async Task<CommentThreadSql> SelectAsync(MathCompsDbContext dbContext, CommentTarget target)
    {
        // The conversation the target names
        var anchor = await ResolveAsync(dbContext, target);

        // The conversation's links, matched on both of its keys
        return new CommentThreadSql(
            "JOIN hosted_grade_comments gc ON c.id = gc.comment_id",
            "gc.entry_id = @p0 AND gc.problem_id = @p1",
            [anchor.EntryId, anchor.ProblemId]);
    }

    /// <inheritdoc />
    public override Task<IQueryable<KeyValuePair<string, int>>> CountAsync(
        MathCompsDbContext dbContext, ImmutableList<string> targetIds, CommentViewer? viewer) =>
        // Never counted in bulk, refused like targets that are not there even to those a conversation is open to
        throw new CommentTargetNotFoundException(TargetType, string.Join(", ", targetIds));

    /// <inheritdoc />
    public override async Task OnEditedAsync(
        MathCompsDbContext dbContext, Guid previousVersionId, Guid newVersionId)
    {
        // The old version's notices
        var notices = await dbContext.GradeMessageNotices
            .Where(notice => notice.CommentId == previousVersionId)
            .ToListAsync();

        // Each notice moved onto the new version, since the mail reads whichever version is current
        foreach (var notice in notices)
            notice.CommentId = newVersionId;
    }

    /// <inheritdoc />
    protected override async Task<GradeAnchor> ResolveAsync(MathCompsDbContext dbContext, CommentTarget target)
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

    /// <inheritdoc />
    protected override async Task<GradeAnchor?> FindAsync(MathCompsDbContext dbContext, Guid commentId)
    {
        // The entry and problem the comment's link points at, with the student whose entry it is
        var grade = await dbContext.HostedGradeComments
            .Where(link => link.CommentId == commentId)
            .Select(link => new { link.EntryId, link.ProblemId, link.Entry.UserId })
            .FirstOrDefaultAsync();

        // Its conversation, or none when the comment hangs off no grade
        return grade is null ? null : new GradeAnchor(grade.EntryId, grade.ProblemId, grade.UserId);
    }

    /// <inheritdoc />
    protected override async Task<bool> IsOpenToAsync(
        MathCompsDbContext dbContext, GradeAnchor anchor, CommentViewer? viewer) =>
        // Open to admins, and to its student while the grade is final and their group has closed
        IsBetween(viewer, anchor.StudentId)
        && (viewer is { IsAdmin: true }
            || await HostedGrading.IsOutToStudentAsync(
                dbContext, anchor.EntryId, anchor.ProblemId, DateTimeOffset.UtcNow, CancellationToken.None));

    /// <inheritdoc />
    protected override void Attach(MathCompsDbContext dbContext, GradeAnchor anchor, Guid commentId) =>
        // A link from the comment to the entry's grade on the problem
        dbContext.HostedGradeComments.Add(new HostedGradeComment
        {
            EntryId = anchor.EntryId,
            ProblemId = anchor.ProblemId,
            CommentId = commentId
        });

    /// <inheritdoc />
    protected override Task OnCreatedAsync(MathCompsDbContext dbContext, GradeAnchor anchor, Comment comment) =>
        // The message is owed to the other side of the conversation by mail
        GradeMessageNotices.QueueAsync(
            dbContext, anchor.EntryId, anchor.ProblemId, anchor.StudentId, comment, CancellationToken.None);

    /// <summary>
    /// Whether a viewer is somebody a grade conversation is between: an admin, or the student it is with.
    /// </summary>
    /// <param name="viewer">Who is asking; null for a signed-out caller.</param>
    /// <param name="studentId">The student the conversation is with.</param>
    /// <returns>Whether the conversation is between them and the graders.</returns>
    private static bool IsBetween(CommentViewer? viewer, Guid studentId) =>
        // Any admin, or the student themselves
        viewer is { IsAdmin: true } || viewer?.UserId == studentId;
}

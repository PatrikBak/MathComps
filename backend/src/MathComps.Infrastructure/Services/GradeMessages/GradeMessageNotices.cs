using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Competitions;
using Microsoft.EntityFrameworkCore;

namespace MathComps.Infrastructure.Services.GradeMessages;

/// <summary>
/// Who is owed word of a new message in a grade conversation: whoever is on the other side of it from the writer,
/// the student only while they can see it.
/// </summary>
internal static class GradeMessageNotices
{
    /// <summary>
    /// Tracks a notice for everybody owed word of a new message, saved with the message itself. A grader's message
    /// is owed to the student, while the student can see the conversation. The student's is owed to whoever gave
    /// the mark as it stands and to every grader with a message standing in the conversation.
    /// </summary>
    /// <param name="dbContext">The context the message is being saved through.</param>
    /// <param name="entryId">The entry of the student the conversation is with.</param>
    /// <param name="problemId">The problem the conversation is about.</param>
    /// <param name="studentId">The student the conversation is with.</param>
    /// <param name="message">The new message, not yet saved.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    public static async Task QueueAsync(
        MathCompsDbContext dbContext,
        Guid entryId,
        Guid problemId,
        Guid studentId,
        Comment message,
        CancellationToken cancellationToken)
    {
        // The other side of the conversation from the writer: the graders when the student wrote, otherwise the
        // student, while they can see the conversation
        var recipientIds = message.AuthorId == studentId
            ? await ReadGradersAsync(dbContext, entryId, problemId, studentId, cancellationToken)
            : await HostedGrading.IsOutToStudentAsync(
                dbContext, entryId, problemId, message.CreatedAt, cancellationToken)
                ? [studentId]
                : [];

        // A notice for each recipient, waiting for a mail
        dbContext.GradeMessageNotices.AddRange(recipientIds.Select(recipientId => new GradeMessageNotice
        {
            RecipientId = recipientId,
            CommentId = message.Id,
            CreatedAt = message.CreatedAt,
        }));
    }

    /// <summary>
    /// Reads the graders a student's message is owed to: whoever gave the mark as it stands, and everybody with a
    /// message standing in the conversation, the student aside.
    /// </summary>
    /// <param name="dbContext">The operation's database context.</param>
    /// <param name="entryId">The student's entry.</param>
    /// <param name="problemId">The problem.</param>
    /// <param name="studentId">The student.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>Each grader once.</returns>
    private static async Task<IReadOnlyList<Guid>> ReadGradersAsync(
        MathCompsDbContext dbContext,
        Guid entryId,
        Guid problemId,
        Guid studentId,
        CancellationToken cancellationToken)
    {
        // Whoever gave the mark as it stands, while anybody has graded
        var markGiver = await HostedGrading.ReadMarkGiverAsync(dbContext, entryId, problemId, cancellationToken);

        // Everybody with a message standing in the conversation, deleted ones not counting
        var writers = await dbContext.HostedGradeComments
            .Where(link => link.EntryId == entryId
                && link.ProblemId == problemId
                && link.Comment.Status == CommentStatus.Active)
            .Select(link => link.Comment.AuthorId)
            .Distinct()
            .ToListAsync(cancellationToken);

        // Whoever gave the mark beside everybody with a message standing there, once each, without the student
        return
        [
            .. (markGiver is { } graderId ? writers.Append(graderId) : writers)
                .Where(writerId => writerId != studentId)
                .Distinct(),
        ];
    }
}

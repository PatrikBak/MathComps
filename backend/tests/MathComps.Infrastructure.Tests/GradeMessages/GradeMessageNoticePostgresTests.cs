using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Extensions;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Comments;
using MathComps.Infrastructure.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using static MathComps.Infrastructure.Tests.TestInfrastructure.HostedSeed;

namespace MathComps.Infrastructure.Tests.GradeMessages;

/// <summary>
/// Integration tests for who is owed word of a new message in a grade conversation, as <see cref="ICommentService"/>
/// queues it against a real PostgreSQL database: that a grader's message is owed to the student only while the
/// student can see the conversation, that the student's is owed to whoever gave the mark as it stands and every
/// grader with a message standing in that conversation, never to its writer, and that an edit owes nobody anything
/// new.
/// </summary>
/// <param name="fixture">The shared PostgreSQL container fixture.</param>
public class GradeMessageNoticePostgresTests(PostgresContainerFixture fixture)
    : PostgresTestBase<ICommentService>(fixture)
{
    /// <summary>
    /// When the student's clock started, days before the group closed.
    /// </summary>
    private static readonly DateTimeOffset _startedAt = new(2026, 9, 15, 10, 0, 0, TimeSpan.Zero);

    /// <summary>
    /// The grader who gave the first mark on the final problem, and never wrote in its conversation.
    /// </summary>
    private readonly CommentViewer _firstGrader = new(Guid.CreateVersion7(), IsAdmin: true);

    /// <summary>
    /// The grader who gave the mark as it stands.
    /// </summary>
    private readonly CommentViewer _markGiver = new(Guid.CreateVersion7(), IsAdmin: true);

    /// <summary>
    /// The grader who made the grade final and then rewrote the graders' note, the mark untouched both times.
    /// </summary>
    private readonly CommentViewer _finalizer = new(Guid.CreateVersion7(), IsAdmin: true);

    /// <summary>
    /// A grader who writes in the conversation without having given the grade.
    /// </summary>
    private readonly CommentViewer _writingGrader = new(Guid.CreateVersion7(), IsAdmin: true);

    /// <summary>
    /// The student the conversation is with.
    /// </summary>
    private readonly CommentViewer _student = new(Guid.CreateVersion7(), IsAdmin: false);

    /// <summary>
    /// Another student, who sat the same round.
    /// </summary>
    private readonly CommentViewer _classmate = new(Guid.CreateVersion7(), IsAdmin: false);

    /// <summary>
    /// The student's entry.
    /// </summary>
    private readonly Guid _studentEntryId = Guid.CreateVersion7();

    /// <summary>
    /// The classmate's entry.
    /// </summary>
    private readonly Guid _classmateEntryId = Guid.CreateVersion7();

    /// <summary>
    /// The problem whose grade is final, so its conversation is out to the student.
    /// </summary>
    private readonly Guid _finalProblemId = Guid.CreateVersion7();

    /// <summary>
    /// The problem whose grade is still a draft, so its conversation is admins only.
    /// </summary>
    private readonly Guid _draftProblemId = Guid.CreateVersion7();

    /// <inheritdoc/>
    protected override void ConfigureServices(IServiceCollection services) =>
        // Register the user services module the test resolves from
        services.AddUserServices();

    /// <summary>
    /// A grader's message is owed to the student while they can see the conversation, and to nobody while its grade
    /// is a draft. It is never owed to the grader who wrote it.
    /// </summary>
    [Fact]
    public Task A_graders_message_is_owed_to_the_student_while_they_can_see_it() => RunTestAsync(async service =>
    {
        // A grader writes in the conversation out to the student
        var visible = await service.CreateCommentAsync(
            GradeConversation(_finalProblemId, _student), _writingGrader, "Two points for the construction.");

        // And in the conversation still closed to the student
        var hidden = await service.CreateCommentAsync(
            GradeConversation(_draftProblemId, _student), _writingGrader, "Still marking this one.");

        // Who is owed word of each message
        var visibleRecipients = await RecipientsAsync(visible.Id);
        var hiddenRecipients = await RecipientsAsync(hidden.Id);

        // The student is owed word of the message they can see
        Assert.Equal([_student.UserId], visibleRecipients);

        // Nobody is owed word of the message still closed to them
        Assert.Empty(hiddenRecipients);
    });

    /// <summary>
    /// The student's message is owed to whoever gave the mark as it stands, though they never wrote, and to every
    /// grader who has written in the conversation, each once. It is owed neither to a grader who only gave an earlier
    /// mark, nor to one who only made the grade final or rewrote the graders' note since, nor to the student, though
    /// they wrote there before.
    /// </summary>
    [Fact]
    public Task A_students_message_is_owed_to_whoever_gave_the_mark_and_every_writer() => RunTestAsync(async service =>
    {
        // The conversation out to the student
        var target = GradeConversation(_finalProblemId, _student);

        // The student asks first
        await service.CreateCommentAsync(target, _student, "Why two points?");

        // A grader who did not give the grade explains it, twice
        await service.CreateCommentAsync(target, _writingGrader, "Two points.");
        await service.CreateCommentAsync(target, _writingGrader, "Also the bound.");

        // The student answers
        var reply = await service.CreateCommentAsync(target, _student, "Thanks, but what about the case n = 1?");

        // Who is owed word of the answer
        var recipients = await RecipientsAsync(reply.Id);

        // Both graders, once each
        Assert.Equal(
            new[] { _markGiver.UserId, _writingGrader.UserId }.Order(),
            recipients.Order());
    });

    /// <summary>
    /// Only whoever wrote in that very conversation is owed the student's message beside whoever gave the mark:
    /// not a grader who wrote only about the student's other problem, and not a classmate who wrote about the same
    /// problem in a conversation of their own.
    /// </summary>
    [Fact]
    public Task A_students_message_is_owed_only_to_who_wrote_in_that_conversation() => RunTestAsync(async service =>
    {
        // A grader writing about the student's draft problem, and the classmate about the final one
        await QueryAsync(async context =>
        {
            // The grader, in the student's conversation about the draft problem
            NewMessage(context, _studentEntryId, _draftProblemId, _firstGrader.UserId, _startedAt.AddDays(7));

            // The classmate, in their own conversation about the final problem
            NewMessage(context, _classmateEntryId, _finalProblemId, _classmate.UserId, _startedAt.AddDays(7));

            // Save the messages
            await context.SaveChangesAsync();
        });

        // The student writes about the final problem
        var message = await service.CreateCommentAsync(
            GradeConversation(_finalProblemId, _student), _student, "Why not three?");

        // Who is owed word of the student's message
        var recipients = await RecipientsAsync(message.Id);

        // Whoever gave the mark, alone
        Assert.Equal([_markGiver.UserId], recipients);
    });

    /// <summary>
    /// A grader whose message in the conversation is deleted is owed the student's message no more: only a message
    /// that stands keeps its writer on the conversation.
    /// </summary>
    [Fact]
    public Task A_grader_whose_message_is_deleted_is_owed_nothing_more() => RunTestAsync(async service =>
    {
        // The conversation out to the student
        var target = GradeConversation(_finalProblemId, _student);

        // A grader writes in the conversation by mistake
        var mistake = await service.CreateCommentAsync(target, _writingGrader, "Wrong student, sorry.");

        // The grader deletes the mistaken message
        await service.DeleteCommentAsync(mistake.Id, _writingGrader);

        // The student writes
        var message = await service.CreateCommentAsync(target, _student, "Why two points?");

        // Who is owed word of the student's message
        var recipients = await RecipientsAsync(message.Id);

        // Whoever gave the mark, alone
        Assert.Equal([_markGiver.UserId], recipients);
    });

    /// <summary>
    /// Whoever gave the mark as it stands and also wrote in the conversation is owed the student's message once, so
    /// their mail counts it once.
    /// </summary>
    [Fact]
    public Task A_grader_who_graded_and_wrote_is_owed_it_once() => RunTestAsync(async service =>
    {
        // The conversation out to the student
        var target = GradeConversation(_finalProblemId, _student);

        // Whoever gave the mark explains it
        await service.CreateCommentAsync(target, _markGiver, "Two points.");

        // The student answers
        var reply = await service.CreateCommentAsync(target, _student, "Why not three?");

        // Who is owed word of the answer
        var recipients = await RecipientsAsync(reply.Id);

        // Whoever gave the mark, once
        Assert.Equal([_markGiver.UserId], recipients);
    });

    /// <summary>
    /// An edit owes nobody anything new, and the message's notices follow it onto its new version, so a mail reads
    /// the version that stands.
    /// </summary>
    [Fact]
    public Task An_edit_owes_nothing_new_and_carries_its_notices() => RunTestAsync(async service =>
    {
        // A grader's message, owed to the student
        var comment = await service.CreateCommentAsync(
            GradeConversation(_finalProblemId, _student), _markGiver, "Two points.");

        // The grader fixes a typo
        var edited = await service.UpdateCommentAsync(comment.Id, _markGiver, "Two points!");

        // Every notice there is
        var notices = await QueryValueAsync(context => context.GradeMessageNotices.AsNoTracking().ToListAsync());

        // Still the one notice to the student, now on the new version
        var notice = Assert.Single(notices);
        Assert.Equal(edited.Id, notice.CommentId);
        Assert.Equal(_student.UserId, notice.RecipientId);
    });

    /// <inheritdoc/>
    protected override async Task SeedDataAsync(MathCompsDbContext context)
    {
        // The graders and both students
        context.Users.AddRange(
            NewUser(_firstGrader.UserId, "FirstGrader"),
            NewUser(_markGiver.UserId, "MarkGiver"),
            NewUser(_finalizer.UserId, "Finalizer"),
            NewUser(_writingGrader.UserId, "WritingGrader"),
            NewUser(_student.UserId, "Student"),
            NewUser(_classmate.UserId, "Classmate"));

        // The one season the round sits in
        var season = new Season { Id = Guid.NewGuid(), StartYear = 2026, EditionNumber = 76 };
        context.Seasons.Add(season);

        // The root the site's own competitions hang off
        CompetitionTreeSeed.Root(context, "mathcomps", 100);

        // The group, closed, so its entries are graded
        var group = NewGroup(context, "mc-graded", _startedAt.AddDays(-5), _startedAt.AddDays(5));

        // Its round with both problems
        var roundId = Guid.CreateVersion7();
        NewRound(context, season, group, roundId, "mathcomps-advanced-september", _finalProblemId, _draftProblemId);

        // Both students sat it, under the ids the tests address them by
        var entry = NewEntry(_student.UserId, roundId, _startedAt);
        var classmateEntry = NewEntry(_classmate.UserId, roundId, _startedAt);
        entry.Id = _studentEntryId;
        classmateEntry.Id = _classmateEntryId;
        context.HostedEntries.AddRange(entry, classmateEntry);

        // And the student argued both problems inside the clock
        NewConversation(context, Guid.CreateVersion7(), _student.UserId, _finalProblemId, _startedAt.AddMinutes(10));
        NewConversation(context, Guid.CreateVersion7(), _student.UserId, _draftProblemId, _startedAt.AddMinutes(20));

        // When the grades were given, a day after the group closed
        var gradedAt = _startedAt.AddDays(6);

        // The first problem's newest version: the third grader's note on the final grade, the mark left as it was
        var annotated = NewGrade(
            entry.Id, _finalProblemId, _finalizer.UserId, mark: 3, help: 0, isFinal: true, gradedAt.AddMinutes(3));
        annotated.InternalComment = "Checked against the scheme.";

        // The grade on the first problem: marked by one grader, marked again as it stands by another, then made final
        // and annotated by a third, who left the mark as it was
        context.HostedGrades.AddRange(
            NewGrade(entry.Id, _finalProblemId, _firstGrader.UserId, mark: 2, help: 0, isFinal: false, gradedAt),
            NewGrade(
                entry.Id, _finalProblemId, _markGiver.UserId, mark: 3, help: 0, isFinal: false,
                gradedAt.AddMinutes(1)),
            NewGrade(
                entry.Id, _finalProblemId, _finalizer.UserId, mark: 3, help: 0, isFinal: true,
                gradedAt.AddMinutes(2)),
            annotated);

        // The grade on the second problem, still a draft
        context.HostedGrades.Add(
            NewGrade(entry.Id, _draftProblemId, _markGiver.UserId, mark: 5, help: 0, isFinal: false, gradedAt));

        // Save seeded data
        await context.SaveChangesAsync();
    }

    /// <summary>
    /// Reads who is owed word of one message.
    /// </summary>
    /// <param name="commentId">The message.</param>
    /// <returns>Each recipient, once per notice.</returns>
    private Task<List<Guid>> RecipientsAsync(Guid commentId) =>
        // The recipients of the message's notices
        QueryValueAsync(context => context.GradeMessageNotices
            .Where(notice => notice.CommentId == commentId)
            .Select(notice => notice.RecipientId)
            .ToListAsync());
}

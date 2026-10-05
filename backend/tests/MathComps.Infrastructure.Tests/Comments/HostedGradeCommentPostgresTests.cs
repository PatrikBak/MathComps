using MathComps.Domain.Contracts.Comments;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Extensions;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Comments;
using MathComps.Infrastructure.Tests.TestInfrastructure;
using Microsoft.Extensions.DependencyInjection;
using static MathComps.Infrastructure.Tests.TestInfrastructure.HostedSeed;

namespace MathComps.Infrastructure.Tests.Comments;

/// <summary>
/// Integration tests for the grade conversation, the private thread between the graders and one student about one
/// problem they were graded on, as <see cref="ICommentService"/> keeps it against a real PostgreSQL database: that
/// admins read and write it, that its student joins once their group has closed, while the grade is final, that
/// nobody else reaches it and a refusal reads like a thread that is not there, that each conversation keeps to
/// itself and no reply crosses into another thread, and that it takes no likes and is never counted in bulk.
/// </summary>
/// <param name="fixture">The shared PostgreSQL container fixture.</param>
public class HostedGradeCommentPostgresTests(PostgresContainerFixture fixture)
    : PostgresTestBase<ICommentService>(fixture)
{
    /// <summary>
    /// When the student's clock started, days before the group closed.
    /// </summary>
    private static readonly DateTimeOffset _startedAt = new(2026, 9, 15, 10, 0, 0, TimeSpan.Zero);

    /// <summary>
    /// The grader writing to the student.
    /// </summary>
    private readonly CommentViewer _grader = new(Guid.CreateVersion7(), IsAdmin: true);

    /// <summary>
    /// A second grader, since any admin writes in the conversation.
    /// </summary>
    private readonly CommentViewer _otherGrader = new(Guid.CreateVersion7(), IsAdmin: true);

    /// <summary>
    /// The student the conversation is with.
    /// </summary>
    private readonly CommentViewer _student = new(Guid.CreateVersion7(), IsAdmin: false);

    /// <summary>
    /// Another student, who sat the same round.
    /// </summary>
    private readonly CommentViewer _classmate = new(Guid.CreateVersion7(), IsAdmin: false);

    /// <summary>
    /// A signed-in user who never entered the round.
    /// </summary>
    private readonly CommentViewer _stranger = new(Guid.CreateVersion7(), IsAdmin: false);

    /// <summary>
    /// The graded problem the conversation is about, whose grade went final and was then taken back.
    /// </summary>
    private readonly Guid _problemId = Guid.CreateVersion7();

    /// <summary>
    /// The round's other problem, whose grade is final.
    /// </summary>
    private readonly Guid _otherProblemId = Guid.CreateVersion7();

    /// <summary>
    /// The graded problem's slug, which names its public thread.
    /// </summary>
    private const string ProblemSlug = "mathcomps-advanced-september-1";

    /// <summary>
    /// The graded round.
    /// </summary>
    private readonly Guid _roundId = Guid.CreateVersion7();

    /// <summary>
    /// The problem of a round whose group is still taking entries, which the student has a final grade on already.
    /// </summary>
    private readonly Guid _openProblemId = Guid.CreateVersion7();

    /// <inheritdoc/>
    protected override void ConfigureServices(IServiceCollection services) =>
        // Register the user services module the test resolves from
        services.AddUserServices();

    /// <summary>
    /// An admin writes in a grade conversation and reads it back, and so does any other admin. An edit keeps the
    /// reply written under the comment, since in this thread a grader fixing a typo must not make the other side
    /// of the conversation vanish.
    /// </summary>
    [Fact]
    public Task Admins_write_edit_and_read_a_grade_conversation() => RunTestAsync(async service =>
    {
        // The conversation with the student about the problem
        var target = GradeConversation(_problemId, _student);

        // A grader explains the mark
        var comment = await service.CreateCommentAsync(target, _grader, "Two points for the construction.");

        // Another grader adds to it
        var reply = await service.CreateCommentAsync(target, _otherGrader, "And one for the bound.", comment.Id);

        // The first grader fixes a typo
        var edited = await service.UpdateCommentAsync(comment.Id, _grader, "Two points for the construction!");

        // The conversation as the second grader reads it
        var thread = await service.GetCommentsAsync(target, _otherGrader);

        // The edited explanation, with the addition still under it
        var root = Assert.Single(thread);
        Assert.Equal(edited.Id, root.Id);
        Assert.Equal("Two points for the construction!", root.Content);
        Assert.Equal(reply.Id, Assert.Single(root.Replies).Id);
    });

    /// <summary>
    /// Before its grade is final, nobody but an admin reaches a grade conversation: not the student it is with, whose
    /// grade went final once and was taken back, not a classmate, not anybody signed out, and not a student whose
    /// grade nobody has given yet, in their own conversation. Each refusal is the one a thread or comment that is
    /// not there gets, so it confirms nothing.
    /// </summary>
    [Fact]
    public Task Before_its_grade_is_final_only_admins_reach_a_grade_conversation() => RunTestAsync(async service =>
    {
        // The conversation with the student, with one comment in it
        var target = GradeConversation(_problemId, _student);
        var comment = await service.CreateCommentAsync(target, _grader, "Two points.");

        // Every caller short of an admin
        CommentViewer?[] outsiders = [_student, _classmate, _stranger, null];

        // None of them reads it
        foreach (var outsider in outsiders)
            await Assert.ThrowsAsync<CommentTargetNotFoundException>(() => service.GetCommentsAsync(target, outsider));

        // Nor does the classmate read their own conversation about the problem, which nobody has graded
        await Assert.ThrowsAsync<CommentTargetNotFoundException>(
            () => service.GetCommentsAsync(GradeConversation(_problemId, _classmate), _classmate));

        // Every signed-in one of them
        CommentViewer[] signedIn = [_student, _classmate, _stranger];

        // None of them writes, replies, edits, deletes or likes there
        foreach (var outsider in signedIn)
        {
            // A new comment, refused like a missing thread
            await Assert.ThrowsAsync<CommentTargetNotFoundException>(
                () => service.CreateCommentAsync(target, outsider, "Why?"));

            // A reply, refused the same way
            await Assert.ThrowsAsync<CommentTargetNotFoundException>(
                () => service.CreateCommentAsync(target, outsider, "Why?", comment.Id));

            // An edit, refused like a missing comment
            await Assert.ThrowsAsync<CommentNotFoundException>(
                () => service.UpdateCommentAsync(comment.Id, outsider, "Six points."));

            // A delete, refused the same way
            await Assert.ThrowsAsync<CommentNotFoundException>(
                () => service.DeleteCommentAsync(comment.Id, outsider));

            // A like, refused the same way
            await Assert.ThrowsAsync<CommentNotFoundException>(
                () => service.ToggleLikeAsync(comment.Id, outsider));
        }

        // The conversation as an admin reads it
        var thread = await service.GetCommentsAsync(target, _grader);

        // Still the one comment, untouched
        var root = Assert.Single(thread);
        Assert.Equal(comment.Id, root.Id);
        Assert.False(root.IsDeleted);
    });

    /// <summary>
    /// Once the grade is final, the student reads the conversation about it, answers in it, and edits and deletes
    /// what they wrote there, and the graders read the answer.
    /// </summary>
    [Fact]
    public Task Once_its_grade_is_final_the_student_reads_and_writes_the_conversation() => RunTestAsync(async service =>
    {
        // The conversation about the final grade
        var target = GradeConversation(_otherProblemId, _student);

        // A grader's explanation in it
        var explanation = await service.CreateCommentAsync(target, _grader, "Five points.");

        // The student reads it
        var thread = await service.GetCommentsAsync(target, _student);

        // The explanation
        Assert.Equal(explanation.Id, Assert.Single(thread).Id);

        // The student answers it
        var answer = await service.CreateCommentAsync(target, _student, "Why not six?", explanation.Id);

        // And rewords the answer
        var reworded = await service.UpdateCommentAsync(answer.Id, _student, "Why not six points?");

        // And adds an aside
        var aside = await service.CreateCommentAsync(target, _student, "Never mind.");

        // Which they delete
        await service.DeleteCommentAsync(aside.Id, _student);

        // The conversation as the grader reads it
        var gradersThread = await service.GetCommentsAsync(target, _grader);

        // The explanation and the aside, in the order written
        Assert.Equal([explanation.Id, aside.Id], gradersThread.Select(comment => comment.Id));

        // The reworded answer under the explanation
        Assert.Equal(reworded.Id, Assert.Single(gradersThread[0].Replies).Id);

        // The aside deleted
        Assert.True(gradersThread[1].IsDeleted);
    });

    /// <summary>
    /// A final grade opens the conversation to the student it is with and to nobody else: a classmate, a stranger
    /// and anybody signed out are refused, reading, writing and touching a comment alike.
    /// </summary>
    [Fact]
    public Task A_final_grade_opens_the_conversation_to_its_own_student_alone() => RunTestAsync(async service =>
    {
        // The conversation about the student's final grade
        var target = GradeConversation(_otherProblemId, _student);

        // A grader's explanation in it
        var comment = await service.CreateCommentAsync(target, _grader, "Five points.");

        // Every caller but the student, short of an admin
        CommentViewer?[] outsiders = [_classmate, _stranger, null];

        // None of them reads it
        foreach (var outsider in outsiders)
            await Assert.ThrowsAsync<CommentTargetNotFoundException>(() => service.GetCommentsAsync(target, outsider));

        // Nor does the classmate write in it
        await Assert.ThrowsAsync<CommentTargetNotFoundException>(
            () => service.CreateCommentAsync(target, _classmate, "Why?"));

        // Nor does the classmate reach the comment in it
        await Assert.ThrowsAsync<CommentNotFoundException>(
            () => service.UpdateCommentAsync(comment.Id, _classmate, "Six points."));
    });

    /// <summary>
    /// A grade ticked final while the student's group is still taking entries keeps its conversation from the
    /// student until the group closes, their own clock having run out long before.
    /// </summary>
    [Fact]
    public Task A_final_grade_opens_nothing_to_its_student_before_the_group_closes() => RunTestAsync(async service =>
    {
        // The conversation about the final grade in the running group
        var target = GradeConversation(_openProblemId, _student);

        // The student does not read it
        await Assert.ThrowsAsync<CommentTargetNotFoundException>(() => service.GetCommentsAsync(target, _student));

        // Nor write in it
        await Assert.ThrowsAsync<CommentTargetNotFoundException>(
            () => service.CreateCommentAsync(target, _student, "Why?"));
    });

    /// <summary>
    /// Grade conversations are never counted in bulk, since the counts are read without asking who is reading:
    /// a count is refused as though the threads were not there, even for a conversation open to its student.
    /// </summary>
    [Fact]
    public Task Grade_conversations_are_never_counted() => RunTestAsync(async service =>
    {
        // A conversation about a final grade
        var target = GradeConversation(_otherProblemId, _student);

        // A grader's comment in it
        await service.CreateCommentAsync(target, _grader, "Five points.");

        // Its count, refused
        await Assert.ThrowsAsync<CommentTargetNotFoundException>(
            () => service.GetCommentCountsAsync(CommentTargetType.HostedGrade, [target.TargetId]));
    });

    /// <summary>
    /// A grade conversation is found by the lookup grading uses, so an id naming nothing to grade is refused like
    /// any thread that is not there, to an admin as well: one that doesn't parse, a student who never entered the
    /// round, a problem outside every hosted round, and a problem a student argued only once their clock had run
    /// out.
    /// </summary>
    [Fact]
    public Task A_conversation_naming_no_graded_entry_is_refused() => RunTestAsync(async service =>
    {
        // Ids naming nothing anybody grades
        CommentTarget[] targets =
        [
            new(CommentTargetType.HostedGrade, "not-a-pair"),
            new(CommentTargetType.HostedGrade, $"{_problemId}:{_problemId}:{_problemId}"),
            GradeConversation(_problemId, _stranger),
            GradeConversation(Guid.CreateVersion7(), _student),
            GradeConversation(_otherProblemId, _classmate),
        ];

        // Each is refused for reading and for writing alike
        foreach (var target in targets)
        {
            // Reading
            await Assert.ThrowsAsync<CommentTargetNotFoundException>(() => service.GetCommentsAsync(target, _grader));

            // Writing
            await Assert.ThrowsAsync<CommentTargetNotFoundException>(
                () => service.CreateCommentAsync(target, _grader, "Two points."));
        }
    });

    /// <summary>
    /// Each grade conversation keeps to itself. A conversation is matched on both the student's entry and the
    /// problem, so neither the same student's conversation about another problem nor a classmate's about the same
    /// one shows up in it.
    /// </summary>
    [Fact]
    public Task Each_grade_conversation_keeps_to_itself() => RunTestAsync(async service =>
    {
        // The student's conversation about the problem
        var conversation = GradeConversation(_problemId, _student);

        // A comment in it
        var comment = await service.CreateCommentAsync(conversation, _grader, "Two points.");

        // A comment in the student's conversation about the other problem
        await service.CreateCommentAsync(GradeConversation(_otherProblemId, _student), _grader, "Five points.");

        // A comment in the classmate's conversation about the same problem
        await service.CreateCommentAsync(GradeConversation(_problemId, _classmate), _grader, "Seven points.");

        // The student's conversation about the problem, as the grader reads it
        var thread = await service.GetCommentsAsync(conversation, _grader);

        // Only its own comment
        Assert.Equal(comment.Id, Assert.Single(thread).Id);
    });

    /// <summary>
    /// A reply must be in its parent's thread. A thread pulls its replies in by their parent alone, so a reply
    /// written against another thread's comment would surface there: a student's reply to a grader's comment,
    /// sent as a public one, would land inside the private conversation, and a grader's reply sent from one
    /// student's conversation would land in another student's.
    /// </summary>
    [Fact]
    public Task A_reply_to_a_comment_in_another_thread_is_refused() => RunTestAsync(async service =>
    {
        // The problem's public thread and the conversation about it
        var publicThread = new CommentTarget(CommentTargetType.Problem, ProblemSlug);
        var conversation = GradeConversation(_problemId, _student);

        // A comment in each
        var privateComment = await service.CreateCommentAsync(conversation, _grader, "Two points.");
        var publicComment = await service.CreateCommentAsync(publicThread, _classmate, "A nice problem.");

        // The student answers the grader from the public thread
        await Assert.ThrowsAsync<CommentNotFoundException>(
            () => service.CreateCommentAsync(publicThread, _student, "Only two?", privateComment.Id));

        // An admin answers a public comment from the conversation
        await Assert.ThrowsAsync<CommentNotFoundException>(
            () => service.CreateCommentAsync(conversation, _grader, "Agreed.", publicComment.Id));

        // An admin answers the student's conversation from the classmate's about the same problem
        await Assert.ThrowsAsync<CommentNotFoundException>(() => service.CreateCommentAsync(
            GradeConversation(_problemId, _classmate), _grader, "Agreed.", privateComment.Id));

        // The conversation, as the admin reads it
        var privateComments = await service.GetCommentsAsync(conversation, _grader);

        // Its one comment, with nothing hanging under it
        Assert.Empty(Assert.Single(privateComments).Replies);

        // The public thread, as a signed-out reader gets it
        var publicComments = await service.GetCommentsAsync(publicThread, null);

        // Its one comment, with nothing hanging under it
        Assert.Empty(Assert.Single(publicComments).Replies);
    });

    /// <summary>
    /// A comment in a grade conversation takes no likes, from an admin either.
    /// </summary>
    [Fact]
    public Task A_grade_conversation_takes_no_likes() => RunTestAsync(async service =>
    {
        // A grader's comment in the conversation
        var comment = await service.CreateCommentAsync(
            GradeConversation(_problemId, _student), _grader, "Two points.");

        // Another grader likes it
        await Assert.ThrowsAsync<CommentNotFoundException>(() => service.ToggleLikeAsync(comment.Id, _otherGrader));
    });

    /// <inheritdoc/>
    protected override async Task SeedDataAsync(MathCompsDbContext context)
    {
        // The graders, the students and a stranger
        context.Users.AddRange(
            NewUser(_grader.UserId, "Grader"),
            NewUser(_otherGrader.UserId, "OtherGrader"),
            NewUser(_student.UserId, "Student"),
            NewUser(_classmate.UserId, "Classmate"),
            NewUser(_stranger.UserId, "Stranger"));

        // The one season the round sits in
        var season = new Season { Id = Guid.NewGuid(), StartYear = 2026, EditionNumber = 76 };
        context.Seasons.Add(season);

        // The root the site's own competitions hang off
        CompetitionTreeSeed.Root(context, "mathcomps", 100);

        // The group, closed, so its entries are graded
        var group = NewGroup(context, "mc-graded", _startedAt.AddDays(-5), _startedAt.AddDays(5));

        // Its round with both problems
        NewRound(context, season, group, _roundId, "mathcomps-advanced-september", _problemId, _otherProblemId);

        // The student and the classmate both sat it
        var studentsEntry = NewEntry(_student.UserId, _roundId, _startedAt);
        context.HostedEntries.AddRange(studentsEntry, NewEntry(_classmate.UserId, _roundId, _startedAt));

        // When the grades were given, a day after the group closed
        var gradedAt = _startedAt.AddDays(6);

        // The student's grade on the problem, final for a moment and then taken back to a draft
        context.HostedGrades.AddRange(
            NewGrade(studentsEntry.Id, _problemId, _grader.UserId, mark: 2, help: 0, isFinal: true, gradedAt),
            NewGrade(
                studentsEntry.Id, _problemId, _grader.UserId, mark: 2, help: 0, isFinal: false,
                gradedAt.AddMinutes(1)));

        // And on the other problem, final
        context.HostedGrades.Add(
            NewGrade(studentsEntry.Id, _otherProblemId, _grader.UserId, mark: 5, help: 0, isFinal: true, gradedAt));

        // A group still taking entries
        var openGroup = NewGroup(
            context, "mc-open", DateTimeOffset.UtcNow.AddDays(-1), DateTimeOffset.UtcNow.AddDays(30));

        // Its round, with one problem
        var openRoundId = Guid.CreateVersion7();
        NewRound(context, season, openGroup, openRoundId, "mathcomps-advanced-october", _openProblemId);

        // The student sat it four hours ago, so their clock has run out
        var openStartedAt = DateTimeOffset.UtcNow.AddHours(-4);
        var openEntry = NewEntry(_student.UserId, openRoundId, openStartedAt);
        context.HostedEntries.Add(openEntry);

        // And argued its problem inside the clock
        NewConversation(context, Guid.CreateVersion7(), _student.UserId, _openProblemId, openStartedAt.AddMinutes(10));

        // And a grader has already marked them final there
        context.HostedGrades.Add(NewGrade(
            openEntry.Id, _openProblemId, _grader.UserId, mark: 7, help: 0, isFinal: true,
            DateTimeOffset.UtcNow.AddMinutes(-5)));

        // The student argued both problems inside the clock
        NewConversation(context, Guid.CreateVersion7(), _student.UserId, _problemId, _startedAt.AddMinutes(10));
        NewConversation(context, Guid.CreateVersion7(), _student.UserId, _otherProblemId, _startedAt.AddMinutes(20));

        // The classmate argued one problem inside the clock
        NewConversation(context, Guid.CreateVersion7(), _classmate.UserId, _problemId, _startedAt.AddMinutes(10));

        // The classmate argued the other problem only once the clock had run out
        NewConversation(
            context, Guid.CreateVersion7(), _classmate.UserId, _otherProblemId, _startedAt.AddMinutes(200));

        // Save seeded data
        await context.SaveChangesAsync();
    }

    /// <summary>
    /// Names the conversation with a student about a problem, the way the client names it.
    /// </summary>
    /// <param name="problemId">The problem.</param>
    /// <param name="student">The student.</param>
    /// <returns>The conversation's target.</returns>
    private static CommentTarget GradeConversation(Guid problemId, CommentViewer student) =>
        // Keyed by the problem and the student, like the grade itself
        new(CommentTargetType.HostedGrade, $"{problemId}:{student.UserId}");
}

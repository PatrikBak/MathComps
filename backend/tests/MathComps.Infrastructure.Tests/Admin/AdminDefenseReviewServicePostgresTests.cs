using MathComps.Domain.Contracts.Admin;
using MathComps.Domain.Contracts.ConversationReview;
using MathComps.Domain.Contracts.Defense;
using MathComps.Domain.EfCoreEntities;
using MathComps.Domain.Localization;
using MathComps.Infrastructure.Options;
using MathComps.Infrastructure.Services.Admin;
using MathComps.Infrastructure.Services.ConversationReview;
using MathComps.Infrastructure.Services.Defense;
using MathComps.Infrastructure.Tests.ConversationReview;
using MathComps.Infrastructure.Tests.TestInfrastructure;
using MathComps.Shared.Extensions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MsOptions = Microsoft.Extensions.Options.Options;
using static MathComps.Infrastructure.Tests.ConversationReview.ConversationReviewSeed;

namespace MathComps.Infrastructure.Tests.Admin;

/// <summary>
/// Integration tests for <see cref="AdminDefenseReviewService"/> against a real PostgreSQL database: that the queue
/// orders and pages the conversations by when they were last spoken to, that its counts follow the filters, that
/// whether a conversation counts as unread is derived from its turns rather than stored, that a row carries what has
/// been written and said about it, that conversations group by the settings they ran on, that one held against a
/// proposal goes by the proposal, and that one held against nothing at all stays out of reach entirely.
/// </summary>
/// <param name="fixture">The shared PostgreSQL container fixture.</param>
public class AdminDefenseReviewServicePostgresTests(PostgresContainerFixture fixture)
    : ConversationReviewPostgresTestBase<IAdminDefenseReviewService>(fixture)
{
    /// <summary>
    /// What each conversation the queue can return is called when a test writes down what a filter left.
    /// </summary>
    private static readonly Dictionary<Guid, string> _conversationNames = new()
    {
        [OldestSessionId] = "oldest",
        [NewerSessionId] = "newer",
        [NewestSessionId] = "newest",
        [ArchiveSessionId] = "competition",
    };

    /// <summary>
    /// The queue reads as one run of conversations, the ones spoken to most recently first, each handout one naming
    /// the environment it was held against. Recency is the last thing said in a conversation rather than the first,
    /// so the one opened twenty days ago and carried on yesterday leads every one opened after it.
    /// </summary>
    [Fact]
    public Task Queue_orders_every_conversation_by_recency() => RunTestAsync(async service =>
    {
        // Read the whole queue
        var queue = await service.GetQueueAsync(ReviewerId, NewFilter(), 1, Language.EN);

        // All four came back, yesterday's leading and the one from ten days ago last
        Assert.Equal(
            [NewestSessionId, ArchiveSessionId, NewerSessionId, OldestSessionId],
            queue.Items.Select(conversation => conversation.Id));

        // Counted in the same unit the page is cut in
        Assert.Equal(4, queue.TotalCount);

        // Each handout one names the environment it was held against
        Assert.Equal(
            ["problem-two", "problem-one", "problem-one"],
            queue.Items
                .Where(conversation => conversation.Target is NamedHandoutTarget)
                .Select(conversation => Handout(conversation.Target).EnvironmentId));

        // Under the handout that environment belongs to
        Assert.All(
            queue.Items.Where(conversation => conversation.Target is NamedHandoutTarget),
            conversation => Assert.Equal(HandoutContentId, Handout(conversation.Target).HandoutContentId));
    });

    /// <summary>
    /// Paging cuts the one run of conversations, so a page carries as many as the server serves and the next one
    /// carries on where it stopped.
    /// </summary>
    [Fact]
    public Task Paging_cuts_the_queue_where_the_page_ends() => RunTestAsync(
        async service =>
        {
            // Ask for the first page
            var first = await service.GetQueueAsync(ReviewerId, NewFilter(), 1, Language.EN);

            // And then for the rest
            var second = await service.GetQueueAsync(ReviewerId, NewFilter(), 2, Language.EN);

            // The first page holds the two most recent, in order
            Assert.Equal(
                [NewestSessionId, ArchiveSessionId],
                first.Items.Select(conversation => conversation.Id));

            // The second carries on with the rest rather than repeating anything
            Assert.Equal(
                [NewerSessionId, OldestSessionId],
                second.Items.Select(conversation => conversation.Id));

            // And both report the same total, which is what says a third page would hold nothing
            Assert.Equal(4, first.TotalCount);
            Assert.Equal(4, second.TotalCount);
        },
        // A page smaller than the seed, so the queue has a second one to carry on to
        services => services.AddSingleton(
            MsOptions.Create(new PaginationOptions { DefaultPageSize = 2 })));

    /// <summary>
    /// Reading a conversation settles it, a message arriving afterwards unsettles it again, and putting it back
    /// to unread makes every message new once more.
    /// </summary>
    [Fact]
    public Task Reading_a_conversation_holds_only_until_its_next_message() => RunTestAsync(async service =>
    {
        // The one message the newest conversation holds is unread to begin with
        Assert.Equal(1, (await GetConversationAsync(service, NewestSessionId)).UnreadStudentMessageCount);

        // Read it
        await ReviewAsync(review => review.MarkReadAsync(ReviewerId, NewestSessionId));

        // The conversation as it stands after the read
        var read = await GetConversationAsync(service, NewestSessionId);

        // Nothing in it is new now, and the read left a stamp behind
        Assert.Equal(0, read.UnreadStudentMessageCount);
        Assert.NotNull(read.ReadAt);

        // The student carries the conversation on
        await QueryAsync(async context =>
        {
            // One more turn, later than the stamp the read left
            context.DefenseTurns.Add(NewTurn(
                NewestSessionId, TranscriptRole.Candidate, "one more thing", 3, DateTimeOffset.UtcNow));

            // Commit it
            await context.SaveChangesAsync();
        });

        // Which brings it back with exactly the one new message against it
        Assert.Equal(1, (await GetConversationAsync(service, NewestSessionId)).UnreadStudentMessageCount);

        // Read it a second time
        await ReviewAsync(review => review.MarkReadAsync(ReviewerId, NewestSessionId));

        // The conversation after the second read
        var reread = await GetConversationAsync(service, NewestSessionId);

        // Which moves the stamp on rather than leaving it where the first pass stopped
        Assert.Equal(0, reread.UnreadStudentMessageCount);
        Assert.True(reread.ReadAt > read.ReadAt);

        // Put it back to unread
        await ReviewAsync(review => review.MarkUnreadAsync(ReviewerId, NewestSessionId));

        // The conversation after it was put back
        var unread = await GetConversationAsync(service, NewestSessionId);

        // Which makes both of the student's messages new again, and leaves no stamp behind
        Assert.Equal(2, unread.UnreadStudentMessageCount);
        Assert.Null(unread.ReadAt);
    });

    /// <summary>
    /// Picking a conversation up from one of its turns leaves that turn and everything after it new, and settles
    /// the ones before it. Naming a turn further down settles what stood unread above it, since where a reader
    /// picks up is one place rather than a run of them. A pick-up from one of the examiner's replies leaves the
    /// row unread with none of the student's messages in it, and the unread filter still finds it.
    /// </summary>
    [Fact]
    public Task Picking_a_conversation_up_from_a_turn_leaves_it_and_the_rest_new() => RunTestAsync(async service =>
    {
        // The student's follow-up and the reply to it
        var followUpId = Guid.Parse("00000000-0000-0000-0000-0000000000b4");
        var lastReplyId = Guid.Parse("00000000-0000-0000-0000-0000000000b5");

        // Carry the conversation on with them, each recorded in its own moment so a stamp can fall between them
        await QueryAsync(async context =>
        {
            // Two more turns
            context.DefenseTurns.AddRange(
                NewTurn(
                    NewestSessionId, TranscriptRole.Candidate, "one more thing", 3,
                    Now.AddHours(-12), followUpId),
                NewTurn(
                    NewestSessionId, TranscriptRole.Examiner, "her last word", 4,
                    Now.AddHours(-6), lastReplyId));

            // Commit them
            await context.SaveChangesAsync();
        });

        // Read the whole thing
        await ReviewAsync(review => review.MarkReadAsync(ReviewerId, NewestSessionId));

        // Pick it back up from the student's follow-up
        await ReviewAsync(review => review.MarkUnreadFromAsync(ReviewerId, NewestSessionId, followUpId));

        // The conversation as it stands after that
        var fromFollowUp = await GetConversationAsync(service, NewestSessionId);

        // Which leaves the follow-up standing as the one message nobody has read
        Assert.Equal(1, fromFollowUp.UnreadStudentMessageCount);

        // When the turn before the follow-up was recorded, read back rather than compared against the seeded
        // stamp, which carries finer ticks than the column keeps
        var precedingAt = await QueryValueAsync(context =>
            context.DefenseTurns
                .Where(turn => turn.Id == NewestReplyId)
                .Select(turn => turn.CreatedAt)
                .SingleAsync());

        // Which is where the reading stops, rather than a moment cut just under the follow-up: that is what
        // keeps the stamp meaning a moment somebody's reading actually stopped
        Assert.Equal(precedingAt, fromFollowUp.ReadAt);

        // Pick it up from the reply instead
        await ReviewAsync(review => review.MarkUnreadFromAsync(ReviewerId, NewestSessionId, lastReplyId));

        // The conversation as it stands after that
        var fromLastReply = await GetConversationAsync(service, NewestSessionId);

        // Which moves where the reading stops down to it. Only the reply itself stands unread, and the count says
        // messages, so it comes back empty while the row still says unread: what is left to read is the
        // examiner's, and she is not the one being counted
        Assert.Equal(0, fromLastReply.UnreadStudentMessageCount);
        Assert.True(fromLastReply.IsUnread);

        // The unread queue as the reviewer sees it now
        var unread = await service.GetQueueAsync(
            ReviewerId, NewFilter() with { Unread = true }, 1, Language.EN);

        // Which agrees with the row, so the reviewer who left it there can still find it
        Assert.Contains(NewestSessionId, unread.Items.Select(row => row.Id));
    });

    /// <summary>
    /// Picking a conversation up from the turn it opens on leaves nothing read at all, which is the state a
    /// conversation nobody has opened is already in.
    /// </summary>
    [Fact]
    public Task Picking_a_conversation_up_from_its_opener_leaves_no_stamp() => RunTestAsync(async service =>
    {
        // Read the whole thing
        await ReviewAsync(review => review.MarkReadAsync(ReviewerId, NewestSessionId));

        // Pick it back up from the opener, which nothing precedes
        await ReviewAsync(review => review.MarkUnreadFromAsync(ReviewerId, NewestSessionId, NewestOpenerId));

        // The conversation as it stands after that
        var reopened = await GetConversationAsync(service, NewestSessionId);

        // Which makes every message new again and drops the stamp rather than leaving one nothing sits before
        Assert.Equal(1, reopened.UnreadStudentMessageCount);
        Assert.Null(reopened.ReadAt);
    });

    /// <summary>
    /// Two turns recorded in one moment move as one, since a stamp is a moment and cannot fall between them. The
    /// student's opening message and the reply it draws are saved together, so picking a conversation up from the
    /// reply leaves the message before it new as well.
    /// </summary>
    [Fact]
    public Task Two_turns_recorded_in_one_moment_are_picked_up_together() => RunTestAsync(async service =>
    {
        // Read the whole thing
        await ReviewAsync(review => review.MarkReadAsync(ReviewerId, NewestSessionId));

        // Pick it up from the reply, which the message before it shares a moment with
        await ReviewAsync(review => review.MarkUnreadFromAsync(ReviewerId, NewestSessionId, NewestReplyId));

        // Both of them stand new, the stamp having landed on the opener before the pair, and the student's own
        // message is the one of the two the count is over
        Assert.Equal(1, (await GetConversationAsync(service, NewestSessionId)).UnreadStudentMessageCount);
    });

    /// <summary>
    /// A reader picks a conversation up from one of its own turns. One belonging to another conversation is
    /// refused rather than dropping the stamp for want of anything before it.
    /// </summary>
    [Fact]
    public Task Picking_up_from_another_conversations_turn_is_refused() => RunTestAsync(async service =>
    {
        // Read the newest conversation
        await ReviewAsync(review => review.MarkReadAsync(ReviewerId, NewestSessionId));

        // Picking it up from a turn the oldest one holds
        await Assert.ThrowsAsync<ReviewTargetException>(
            () => ReviewAsync(review => review.MarkUnreadFromAsync(ReviewerId, NewestSessionId, OldestOpenerId)));

        // And from a turn nothing was seeded under at all
        await Assert.ThrowsAsync<ReviewTargetException>(
            () => ReviewAsync(review => review.MarkUnreadFromAsync(
                ReviewerId, NewestSessionId, Guid.Parse("00000000-0000-0000-0000-0000000000bf"))));

        // Neither of which moved the stamp the conversation already had
        Assert.Equal(0, (await GetConversationAsync(service, NewestSessionId)).UnreadStudentMessageCount);
    });

    /// <summary>
    /// Marking a set settles every conversation in it at once, and an id naming none is passed over rather than
    /// taking the set down with it.
    /// </summary>
    [Fact]
    public Task Marking_a_set_settles_every_conversation_in_it() => RunTestAsync(async service =>
    {
        // An id under which the database holds nothing, riding along with two real ones
        var missingId = Guid.Parse("00000000-0000-0000-0000-0000000000ff");

        // Mark the two real conversations read, alongside one that is gone and one named twice
        await service.MarkManyReadAsync(
            ReviewerId, [NewestSessionId, OldestSessionId, missingId, NewestSessionId]);

        // Both real ones settled, rather than the missing id refusing the whole set
        Assert.Equal(0, (await GetConversationAsync(service, NewestSessionId)).UnreadStudentMessageCount);
        Assert.NotNull((await GetConversationAsync(service, OldestSessionId)).ReadAt);
    });

    /// <summary>
    /// A conversation nobody has ever read counts as unread, rather than falling out of both halves of the filter
    /// for want of a stamp to compare against.
    /// </summary>
    [Fact]
    public Task The_unread_filter_leaves_the_conversations_nobody_has_read() => RunTestAsync(async service =>
    {
        // Ask for the unread ones with nothing opened yet, so no conversation has a stamp of any kind
        var unread = await service.GetQueueAsync(
            ReviewerId, NewFilter() with { Unread = true }, 1, Language.EN);

        // All four count as unread
        Assert.Equal(4, unread.TotalCount);
    });

    /// <summary>
    /// Read marks belong to whoever left them, so one reviewer working through the queue never clears it for
    /// anybody else.
    /// </summary>
    [Fact]
    public Task One_reviewers_read_marks_leave_anothers_queue_alone() => RunTestAsync(async service =>
    {
        // One reviewer reads a conversation
        await ReviewAsync(review => review.MarkReadAsync(ReviewerId, NewestSessionId));

        // Their own unread queue
        var read = await service.GetQueueAsync(
            ReviewerId, NewFilter() with { Unread = true }, 1, Language.EN);

        // Which settles the one they read
        Assert.Equal(3, read.TotalCount);

        // The other reviewer's, who has read nothing
        var other = await service.GetQueueAsync(
            OtherReviewerId, NewFilter() with { Unread = true }, 1, Language.EN);

        // Where all four still stand
        Assert.Equal(4, other.TotalCount);

        // And the detail carries each reviewer their own stamp
        Assert.NotNull((await ReadDetailAsync(ReviewerId, NewestSessionId)).ReadAt);
        Assert.Null((await ReadDetailAsync(OtherReviewerId, NewestSessionId)).ReadAt);

        // The other reviewer puts it back to unread, which takes only their own stamp, and they never had one
        await ReviewAsync(review => review.MarkUnreadAsync(OtherReviewerId, NewestSessionId));

        // So the first reviewer's still stands
        Assert.NotNull((await ReadDetailAsync(ReviewerId, NewestSessionId)).ReadAt);
    });

    /// <summary>
    /// Conversations group by the settings they ran on, reading two snapshots the database considers equal as one
    /// version however they were written, and the ones held before settings were recorded as a version of their own.
    /// </summary>
    [Fact]
    public Task Conversations_group_by_the_settings_they_ran_on() => RunTestAsync(async service =>
    {
        // Read what the filters can be set to
        var options = await service.GetFilterOptionsAsync(Language.EN);

        // Three versions across the four conversations that name a problem
        Assert.Equal(3, options.PromptVersions.Count);

        // The one the two written differently share
        var shared = options.PromptVersions.Single(version => version.ConversationCount == 2);

        // Narrow the queue to the shared version
        var queue = await service.GetQueueAsync(
            ReviewerId, NewFilter() with { PromptVersion = shared.Version }, 1, Language.EN);

        // Which leaves exactly the two that ran on it
        Assert.Equal(2, queue.TotalCount);
    });

    /// <summary>
    /// A queue row reports what the conversation holds: the student who held it, their most recent message rather
    /// than the examiner's or an earlier one of their own, how many of their messages it holds, what has been
    /// written about it, and which of the two things a student can leave behind it carries.
    /// </summary>
    [Fact]
    public Task A_queue_row_reports_what_the_conversation_holds() => RunTestAsync(async service =>
    {
        // Write a note against one of its replies
        await QueryAsync<IReviewNoteService>((_, notes) => notes.CreateAsync(
            ReviewerId, NewestSessionId, NewestReplyId, "she gave it away", null));

        // Take the conversation past the student's opening message, so an earlier one of theirs can't win
        await QueryAsync(async context =>
        {
            // A second student turn, after the reply the seed left
            context.DefenseTurns.Add(NewTurn(
                NewestSessionId, TranscriptRole.Candidate, "and here is my fix", 3, Now));

            // Commit it
            await context.SaveChangesAsync();
        });

        // Read the row back
        var row = await GetConversationAsync(service, NewestSessionId);

        // It names who held the conversation
        Assert.Equal("Student", row.User.Username);

        // Reads what the student last said, not the examiner's reply nor the message they opened with
        Assert.Equal("and here is my fix", row.LastStudentMessage);

        // Counts what the student has said in it
        Assert.Equal(2, row.StudentMessageCount);

        // Carries the note
        Assert.Equal(1, row.NoteCount);

        // And reports the complaint the student left against one of its replies, with no verdict on the whole of it
        Assert.True(row.HasStudentReport);
        Assert.False(row.HasStudentFeedback);

        // The conversation carrying the other of the two
        var answered = await GetConversationAsync(service, OldestSessionId);

        // Reports them the other way round, which is what says the two marks aren't one predicate written twice
        Assert.False(answered.HasStudentReport);
        Assert.True(answered.HasStudentFeedback);
    });

    /// <summary>
    /// A deleted student is not named in the queue. Deletion leaves the username in the database, since the name
    /// stays reserved for good, so withholding it is each projection's own job.
    /// </summary>
    [Fact]
    public Task A_deleted_student_is_no_longer_named() => RunTestAsync(async service =>
    {
        // The student who held the conversation leaves
        await QueryAsync(async context =>
        {
            // The student's row
            var student = await context.Users.SingleAsync(user => user.Id == StudentId);

            // Marked gone the way deletion marks it, which leaves the name standing
            student.IsDeleted = true;

            // Commit it
            await context.SaveChangesAsync();
        });

        // Read the row back
        var row = await GetConversationAsync(service, NewestSessionId);

        // It holds nobody the review can name
        Assert.Null(row.User.Username);
    });

    /// <summary>
    /// Each filter narrows the queue to what it names, and nothing else. Run together rather than one test each
    /// because they are near-identical clauses written in one sitting, which is exactly where an inverted one hides;
    /// comparing the whole set at once still names which clause was wrong.
    /// </summary>
    [Fact]
    public Task Each_filter_narrows_the_queue_to_what_it_names() => RunTestAsync(async service =>
    {
        // Something written about one of them, so the notes filter has both directions to tell apart
        await QueryAsync<IReviewNoteService>((_, notes) => notes.CreateAsync(
            ReviewerId, NewestSessionId, NewestReplyId, "worth a second look", null));

        // And that same conversation carried on just now, so the shortest period a filter can name has one
        // conversation to keep and two to drop rather than nothing to say either way about
        await QueryAsync(async context =>
        {
            // One more turn, stamped as this moment
            context.DefenseTurns.Add(NewTurn(
                NewestSessionId, TranscriptRole.Candidate, "one more thing", 3, DateTimeOffset.UtcNow));

            // Commit it
            await context.SaveChangesAsync();
        });

        // One more reply in every conversation the queue can return, with drafts the guards caught things in. Every
        // flaw lands on its own set of conversations, so a flaw read off another one's verdict leaves the wrong set.
        // Each reply is stamped alongside the last thing already said in its conversation, so the periods keep their
        // answers
        await QueryAsync(async context =>
        {
            // The replies the drafts were written for
            var oldestReply = NewTurn(
                OldestSessionId, TranscriptRole.Examiner, "a closing reply", 2, Now.AddDays(-10));
            var newerReply = NewTurn(
                NewerSessionId, TranscriptRole.Examiner, "a careful reply", 2, Now.AddDays(-5));
            var newestReply = NewTurn(
                NewestSessionId, TranscriptRole.Examiner, "a last reply", 4, DateTimeOffset.UtcNow);
            var competitionReply = NewTurn(
                ArchiveSessionId, TranscriptRole.Examiner, "follow the reference", 2, Now.AddDays(-3));

            // Each added to its conversation
            context.DefenseTurns.AddRange(oldestReply, newerReply, newestReply, competitionReply);

            // The oldest pressed on past a finished proof, in the wrong language and taking the student for a man or
            // a woman, before the draft that went out
            context.DefenseTurnAttempts.AddRange(
                NewAttempt(OldestSessionId, oldestReply.Id, attemptIndex: 0, "keep going",
                    withholdsClose: true, switchesLanguage: true, gendersTheReader: true),
                NewAttempt(OldestSessionId, oldestReply.Id, attemptIndex: 1, "a closing reply"));

            // The newer got a claim wrong in the wrong language, then gave something away, and only then went out
            // clean, so the switched language and the leak never share a draft
            context.DefenseTurnAttempts.AddRange(
                NewAttempt(NewerSessionId, newerReply.Id, attemptIndex: 0, "a wrong draft",
                    mathHolds: false, switchesLanguage: true),
                NewAttempt(NewerSessionId, newerReply.Id, attemptIndex: 1, "a leaky draft", leaks: true),
                NewAttempt(NewerSessionId, newerReply.Id, attemptIndex: 2, "a careful reply"));

            // The newest walked the student onto the examiner's own route and took them for a man or a woman, before a
            // clean draft went out ending on a finished proof, which withholds nothing
            context.DefenseTurnAttempts.AddRange(
                NewAttempt(NewestSessionId, newestReply.Id, attemptIndex: 0, "follow my way",
                    gendersTheReader: true, takesOver: true),
                NewAttempt(NewestSessionId, newestReply.Id, attemptIndex: 1, "a last reply", closesComplete: true));

            // The competition one drifted out of the student's language, and its rewrite took over their route and
            // went out anyway once the revisions ran out, so its takeover sits on no draft that was sent back
            context.DefenseTurnAttempts.AddRange(
                NewAttempt(ArchiveSessionId, competitionReply.Id, attemptIndex: 0, "a drifted draft",
                    switchesLanguage: true),
                NewAttempt(ArchiveSessionId, competitionReply.Id, attemptIndex: 1, "follow the reference",
                    takesOver: true));

            // Commit them
            await context.SaveChangesAsync();
        });

        // Every filter paired with how many of the seeded conversations it should leave and which they are. Naming
        // them is what tells two filters apart that happen to leave the same number, which is where a clause wired
        // to its neighbour's column would otherwise sit unnoticed
        (string Description, AdminDefenseQueueFilter Filter, int Count, string Left)[] cases =
        [
            ("one student holds three of the four",
                NewFilter() with { UserId = StudentId }, 3, "newest, competition, oldest"),
            ("every handout conversation is against the seeded handout",
                NewFilter() with { HandoutContentId = HandoutContentId }, 3, "newest, newer, oldest"),
            ("a handout nothing was held against leaves nothing",
                NewFilter() with { HandoutContentId = "no-such-handout" }, 0, ""),
            ("two were held against the shared environment",
                NewFilter() with { EnvironmentId = "problem-one" }, 2, "newer, oldest"),
            ("the archive problem leaves the one held against it",
                NewFilter() with { ProblemSlug = ArchiveProblemSlug }, 1, "competition"),
            ("a problem nothing was held against leaves nothing",
                NewFilter() with { ProblemSlug = "no-such-problem" }, 0, ""),
            ("one has been written about", NewFilter() with { HasNotes = true }, 1, "newest"),
            ("leaving the other three unwritten-about",
                NewFilter() with { HasNotes = false }, 3, "competition, newer, oldest"),
            ("one student reported a reply", NewFilter() with { StudentReported = true }, 1, "newest"),
            ("and a different conversation was answered for",
                NewFilter() with { StudentFeedback = true }, 1, "oldest"),
            ("only the one carried on yesterday falls inside three days, however long ago it opened",
                NewFilter() with { WithinDays = 3 }, 1, "newest"),
            ("a period past the ceiling is held to it rather than falling off the calendar",
                NewFilter() with { WithinDays = int.MaxValue }, 4, "newest, competition, newer, oldest"),
            ("and a period of no days is held to one day, which the one carried on just now falls inside",
                NewFilter() with { WithinDays = 0 }, 1, "newest"),
            ("a wrong claim was caught in one, though the reply it was caught behind went out clean",
                NewFilter() with { CaughtFlaws = [ExaminerFlaw.WrongClaim] }, 1, "newer"),
            ("a leak in two, one of them the seed's own sent-back draft",
                NewFilter() with { CaughtFlaws = [ExaminerFlaw.Leak] }, 2, "newest, newer"),
            ("a withheld close in one, though another's solution was complete too",
                NewFilter() with { CaughtFlaws = [ExaminerFlaw.WithheldClose] }, 1, "oldest"),
            ("a switched language in three",
                NewFilter() with { CaughtFlaws = [ExaminerFlaw.LanguageSwitch] }, 3, "competition, newer, oldest"),
            ("a gendered address in two",
                NewFilter() with { CaughtFlaws = [ExaminerFlaw.GenderedAddress] }, 2, "newest, oldest"),
            ("and a takeover in two, one only on the reply that went out, which counts as much as one sent back",
                NewFilter() with { CaughtFlaws = [ExaminerFlaw.Route] }, 2, "newest, competition"),
            ("naming two flaws leaves the one both were caught in, though never on the same draft",
                NewFilter() with { CaughtFlaws = [ExaminerFlaw.Leak, ExaminerFlaw.LanguageSwitch] }, 1, "newer"),
        ];

        // What each filter left, labelled so a mismatch says which clause was wrong
        var actual = new List<string>();

        // One queue read per filter
        foreach (var (description, filter, _, _) in cases)
        {
            // What this one leaves
            var queue = await service.GetQueueAsync(ReviewerId, filter, 1, Language.EN);

            // Recorded under its label, by the pager's count and by the conversations on the page
            actual.Add($"{description}: {queue.TotalCount} ({Describe(queue.Items)})");
        }

        // Compare the whole set at once
        Assert.Equal([.. cases.Select(one => $"{one.Description}: {one.Count} ({one.Left})")], actual);
    });

    /// <summary>
    /// A conversation held against an archive problem reaches the queue alongside the handout ones, named by the
    /// competition it was set in rather than by an id the reviewer's side has nothing to resolve.
    /// </summary>
    [Fact]
    public Task An_archive_problem_reads_back_named_by_where_it_comes_from() => RunTestAsync(async service =>
    {
        // The whole queue, which holds conversations of both kinds
        var queue = await service.GetQueueAsync(ReviewerId, NewFilter(), 1, Language.EN);

        // The competition one, which the queue carries as an archive problem rather than a handout one
        var conversation = Assert.Single(
            queue.Items.Where(candidate => candidate.Id == ArchiveSessionId));

        // Named by the problem's slug and where the problem comes from
        var target = Assert.IsType<NamedProblemTarget>(conversation.Target);
        Assert.Equal(ArchiveProblemSlug, target.Slug);

        // Which is every competition down to the one that set it, each named in the language asked for
        Assert.Equal(
            ["Mathilding", "Advanced", "September"],
            target.Source.Competition.Select(competition => competition.DisplayName));

        // Along with the season's own year and the problem's place in the competition
        Assert.Equal(2026, target.Source.StartYear);
        Assert.Equal(2, target.Source.Number);
    });

    /// <summary>
    /// The queue narrows to one archive problem by its slug, which addresses it on its own.
    /// </summary>
    [Fact]
    public Task The_queue_narrows_to_one_archive_problem() => RunTestAsync(async service =>
    {
        // Narrowed to the one problem out of the archive
        var queue = await service.GetQueueAsync(
            ReviewerId, NewFilter() with { ProblemSlug = ArchiveProblemSlug }, 1, Language.EN);

        // Which leaves the one conversation held against it
        Assert.Equal([ArchiveSessionId], queue.Items.Select(conversation => conversation.Id));
    });

    /// <summary>
    /// An archive problem is offered as a filter option beside the handout ones, so the facet reaches both kinds.
    /// </summary>
    [Fact]
    public Task Filter_options_name_the_archive_problem_too() => RunTestAsync(async service =>
    {
        // What the filters can be set to
        var options = await service.GetFilterOptionsAsync(Language.EN);

        // The archive problem among them, carrying the one conversation held against it
        var option = Assert.Single(
            options.Problems.Where(candidate => candidate.Target is NamedProblemTarget));
        Assert.Equal(1, option.ConversationCount);

        // Named the same way the queue names it
        Assert.Equal(ArchiveProblemSlug, Assert.IsType<NamedProblemTarget>(option.Target).Slug);
    });

    /// <summary>
    /// Everyone who has held a conversation and every environment one was held against read back as filter options,
    /// each carrying how many conversations it accounts for, the busiest first.
    /// </summary>
    [Fact]
    public Task Filter_options_name_every_student_and_environment_with_their_counts() => RunTestAsync(async service =>
    {
        // Read what the filters can be set to
        var options = await service.GetFilterOptionsAsync(Language.EN);

        // Both students who held one, the one holding three ahead of the one holding one, and neither reviewer
        Assert.Equal(
            [StudentId, OtherStudentId],
            options.Students.Select(option => option.User.Id));
        Assert.Equal([3, 1], options.Students.Select(option => option.ConversationCount));

        // The handout environments one was held against, the shared one ahead of the other
        var handoutOptions = options.Problems
            .Where(option => option.Target is NamedHandoutTarget)
            .ToList();
        Assert.Equal(
            ["problem-one", "problem-two"],
            handoutOptions.Select(option => Handout(option.Target).EnvironmentId));
        Assert.Equal([2, 1], handoutOptions.Select(option => option.ConversationCount));

        // Each under the handout it belongs to
        Assert.All(
            handoutOptions,
            option => Assert.Equal(HandoutContentId, Handout(option.Target).HandoutContentId));
    });

    /// <summary>
    /// A student's conversations on a handout environment are their own on that environment alone, and carry no
    /// grading, since nobody grades a handout.
    /// </summary>
    [Fact]
    public Task A_students_conversations_on_a_handout_environment_carry_no_grading() => RunTestAsync(async service =>
    {
        // The environment the other student argued too
        var target = new HandoutEnvironmentTarget(HandoutContentId, "problem-one");

        // Read the student's conversations on it
        var read = await service.GetStudentConversationsAsync(StudentId, target);

        // Only their own there, the other student's and the other environment's left out
        Assert.Equal([OldestSessionId], read.Conversations.Select(conversation => conversation.Id));

        // Graded by nobody
        Assert.Null(read.Grading);
    });

    /// <summary>
    /// A conversation held against nothing at all is out of the reviewer's reach altogether: it never reaches the
    /// queue, which has nothing to name it by, and asking for it outright reads as absent rather than opening it.
    /// </summary>
    [Fact]
    public Task A_conversation_held_against_nothing_stays_out_of_reach() => RunTestAsync(async service =>
    {
        // Read the whole queue, narrowed by nothing
        var queue = await service.GetQueueAsync(ReviewerId, NewFilter(), 1, Language.EN);

        // The four that name a problem are all of it, though the targetless one moved more recently than most of them
        Assert.Equal(4, queue.TotalCount);
        Assert.DoesNotContain(TargetlessSessionId, queue.Items.Select(conversation => conversation.Id));

        // And asking for it by name is refused the same way an id nothing was seeded under is
        await Assert.ThrowsAsync<DefenseSessionNotFoundException>(
            () => ReadDetailAsync(ReviewerId, TargetlessSessionId));
    });

    /// <summary>
    /// A conversation held against a proposal goes by the proposal wherever the review surface names it: its row in
    /// the queue, its option among the filters, and the conversation opened in full. Each of those reads the problem
    /// on its own, so one naming it right says nothing of the others. Its slug narrows the queue to it the way an
    /// archive problem's does.
    /// </summary>
    [Fact]
    public Task A_proposals_conversation_goes_by_the_proposal() => RunTestAsync(async service =>
    {
        // The conversation about the proposal
        var sessionId = Guid.CreateVersion7();

        // The problem the proposal files, once it is written
        var problemId = Guid.Empty;

        // The student's conversation about a problem parked among the proposals
        await QueryAsync(async context =>
        {
            // A round among the proposals
            var round = SelectionSeed.NewProposalsRound(context, await context.Seasons.SingleAsync());

            // The proposal in it, quoted by a number its problem's own row doesn't share
            problemId = SelectionSeed.NewProposal(context, round, number: 21, position: 3);

            // The conversation
            context.DefenseSessions.Add(NewSession(sessionId, StudentId, ExaminerConfig, DefenseTargetKind.Problem));

            // With the one message the student opened it with
            context.DefenseTurns.Add(NewTurn(sessionId, TranscriptRole.Candidate, "my proposal defense", 0, Now));

            // Held against that problem
            context.ProblemDefenses.Add(new ProblemDefense { DefenseSessionId = sessionId, ProblemId = problemId });

            // Written down
            await context.SaveChangesAsync();
        });

        // Read the whole queue
        var queue = await service.GetQueueAsync(ReviewerId, NewFilter(), 1, Language.EN);

        // The row of the conversation about the proposal, which names a proposal rather than a competition problem
        var proposal = Assert.IsType<NamedProposalTarget>(
            Assert.Single(queue.Items, conversation => conversation.Id == sessionId).Target);

        // By the proposal filing the problem: the number and the working name the reviewers quote it by
        Assert.Equal((problemId, 21, "Proposal 21"), (proposal.ProblemId, proposal.Number, proposal.Title));

        // Read what the filters can be set to
        var options = await service.GetFilterOptionsAsync(Language.EN);

        // The proposal is offered among them, named the same way
        Assert.Contains(options.Problems, option => option.Target == proposal);

        // Narrow the queue by the proposal's slug
        var narrowed = await service.GetQueueAsync(
            ReviewerId, NewFilter() with { ProblemSlug = proposal.Slug }, 1, Language.EN);

        // Which leaves the one conversation held against it
        Assert.Equal([sessionId], narrowed.Items.Select(conversation => conversation.Id));

        // Open the conversation in full
        var detail = await ReadDetailAsync(ReviewerId, sessionId);

        // Which names it the same way again
        Assert.Equal(proposal, detail.Target);
    });

    /// <summary>
    /// Runs one call through the review service, in a scope of its own.
    /// </summary>
    /// <param name="call">The call, handed the review service.</param>
    /// <returns>A task representing the call.</returns>
    private Task ReviewAsync(Func<IConversationReviewService, Task> call) =>
        // The review service, resolved over the same database
        QueryAsync<IConversationReviewService>((_, review) => call(review));

    /// <summary>
    /// Reads one conversation in full through the review service, in a scope of its own.
    /// </summary>
    /// <param name="readerId">Whose read stamp to carry back with it.</param>
    /// <param name="sessionId">The conversation to read.</param>
    /// <returns>The whole conversation.</returns>
    private Task<ConversationDetailDto> ReadDetailAsync(Guid readerId, Guid sessionId) =>
        // The conversation as the review service reads it, in English
        QueryValueAsync<IConversationReviewService, ConversationDetailDto>(
            (_, review) => review.GetDetailAsync(readerId, sessionId, Language.EN));

    /// <summary>
    /// Names the conversations a filter left, in the order the queue put them, so a mismatch reads as which
    /// conversations came back rather than as a run of guids.
    /// </summary>
    /// <param name="conversations">The rows a filter left.</param>
    /// <returns>Their names, comma-separated.</returns>
    private static string Describe(IEnumerable<AdminDefenseConversationDto> conversations) =>
        conversations.Select(conversation => _conversationNames[conversation.Id]).ToJoinedString();

    /// <summary>
    /// Reads one conversation's row out of the whole queue.
    /// </summary>
    /// <param name="service">The service under test.</param>
    /// <param name="sessionId">The conversation to find.</param>
    /// <returns>Its row.</returns>
    private static async Task<AdminDefenseConversationDto> GetConversationAsync(
        IAdminDefenseReviewService service, Guid sessionId)
    {
        // The whole queue, since a row only exists as part of it
        var queue = await service.GetQueueAsync(ReviewerId, NewFilter(), 1, Language.EN);

        // The row under that id
        return queue.Items.Single(conversation => conversation.Id == sessionId);
    }

    /// <summary>
    /// Reads a conversation's problem as the handout environment it is, failing the test when it is anything
    /// else, which is what lets an assertion name a handout's own fields.
    /// </summary>
    /// <param name="target">The problem a conversation was held against.</param>
    /// <returns>The handout environment.</returns>
    private static NamedHandoutTarget Handout(NamedDefenseTarget target) =>
        Assert.IsType<NamedHandoutTarget>(target);

    /// <summary>
    /// Builds a filter that narrows nothing, so a test naming no filter reads the whole seed. Tests that do want
    /// one narrow it with a `with` expression, which names the field rather than counting commas to it.
    /// </summary>
    /// <returns>The filter.</returns>
    private static AdminDefenseQueueFilter NewFilter() =>
        new(false, null, false, false, null, null, null, null, null, null, null);
}

using MathComps.Domain.Contracts.Admin;
using MathComps.Domain.Contracts.Defense;
using MathComps.Domain.EfCoreEntities;
using MathComps.Domain.Localization;
using MathComps.Infrastructure.Extensions;
using MathComps.Infrastructure.Options;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Admin;
using MathComps.Infrastructure.Services.Defense;
using MathComps.Infrastructure.Services.Localization;
using MathComps.Infrastructure.Tests.TestInfrastructure;
using MathComps.Shared.Extensions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MsOptions = Microsoft.Extensions.Options.Options;

namespace MathComps.Infrastructure.Tests.Admin;

/// <summary>
/// Integration tests for <see cref="AdminDefenseReviewService"/> against a real PostgreSQL database: that the queue
/// orders and pages the conversations by when they were last spoken to, that its counts follow the filters, that
/// whether a conversation counts as unread is derived from its turns rather than stored, that a row and the whole
/// conversation behind it carry what has been written and said about them, that conversations group by the settings
/// they ran on, and that one held against nothing at all stays out of reach entirely.
/// </summary>
/// <param name="fixture">The shared PostgreSQL container fixture.</param>
public class AdminDefenseReviewServicePostgresTests(PostgresContainerFixture fixture)
    : PostgresTestBase<IAdminDefenseReviewService>(fixture)
{
    /// <summary>
    /// The student who holds most of the seeded conversations.
    /// </summary>
    private static readonly Guid _studentId = Guid.Parse("00000000-0000-0000-0000-000000000001");

    /// <summary>
    /// A second student, so filtering by who held a conversation has something to leave out.
    /// </summary>
    private static readonly Guid _otherStudentId = Guid.Parse("00000000-0000-0000-0000-000000000002");

    /// <summary>
    /// The reviewer reading the queue.
    /// </summary>
    private static readonly Guid _reviewerId = Guid.Parse("00000000-0000-0000-0000-0000000000f1");

    /// <summary>
    /// A second reviewer, so one reading a conversation has somebody else's queue to leave alone.
    /// </summary>
    private static readonly Guid _otherReviewerId = Guid.Parse("00000000-0000-0000-0000-0000000000f2");

    /// <summary>
    /// The settings the competition conversation ran on, shared with nothing else so that the grouping by
    /// version still has exactly one pair to find.
    /// </summary>
    private const string ArchiveExaminerConfig =
        /*lang=json,strict*/ """{"generate":{"model":"gemini-3.6-flash","promptText":"be strict"}}""";

    /// <summary>
    /// The archive problem one of the conversations was held against.
    /// </summary>
    private static readonly Guid _archiveProblemId = Guid.Parse("00000000-0000-0000-0000-0000000000d1");

    /// <summary>
    /// The conversation held against that problem.
    /// </summary>
    private static readonly Guid _archiveSessionId = Guid.Parse("00000000-0000-0000-0000-0000000000a5");

    /// <summary>
    /// The slug addressing the archive problem, which is what the queue is narrowed to it by.
    /// </summary>
    private const string ArchiveProblemSlug = "76-mc-advanced-1-2";

    /// <summary>
    /// The node the archive problem's competition sits at. Registered in the taxonomy, since naming the
    /// competition is the whole of what this arm adds.
    /// </summary>
    private const string ArchiveCompetitionPath = "mc-advanced-1";

    /// <summary>
    /// The handout environment two of the conversations were held against.
    /// </summary>
    private static readonly Guid _sharedEnvironmentId = Guid.Parse("00000000-0000-0000-0000-0000000000e1");

    /// <summary>
    /// A second handout environment, so the queue names more than one across its conversations.
    /// </summary>
    private static readonly Guid _otherEnvironmentId = Guid.Parse("00000000-0000-0000-0000-0000000000e2");

    /// <summary>
    /// The oldest conversation against the shared environment.
    /// </summary>
    private static readonly Guid _oldestSessionId = Guid.Parse("00000000-0000-0000-0000-0000000000a1");

    /// <summary>
    /// The newer conversation against the shared environment, held by the other student.
    /// </summary>
    private static readonly Guid _newerSessionId = Guid.Parse("00000000-0000-0000-0000-0000000000a2");

    /// <summary>
    /// The only conversation against the second environment, and the most recently active of them all. Opened long
    /// before the other two and carried on yesterday, so where it lands says which end of its turns the queue reads.
    /// </summary>
    private static readonly Guid _newestSessionId = Guid.Parse("00000000-0000-0000-0000-0000000000a3");

    /// <summary>
    /// A conversation held against nothing at all, which every read is meant to leave out.
    /// </summary>
    private static readonly Guid _targetlessSessionId = Guid.Parse("00000000-0000-0000-0000-0000000000a4");

    /// <summary>
    /// The turn the oldest conversation opens on, which belongs to no other conversation.
    /// </summary>
    private static readonly Guid _oldestOpenerId = Guid.Parse("00000000-0000-0000-0000-0000000000b1");

    /// <summary>
    /// The turn the newest conversation opens on, which nothing in it precedes.
    /// </summary>
    private static readonly Guid _newestOpenerId = Guid.Parse("00000000-0000-0000-0000-0000000000b2");

    /// <summary>
    /// The reply the newest conversation ends on, which a note and the student's report are written against.
    /// </summary>
    private static readonly Guid _newestReplyId = Guid.Parse("00000000-0000-0000-0000-0000000000b3");

    /// <summary>
    /// What each conversation the queue can return is called when a test writes down what a filter left.
    /// </summary>
    private static readonly Dictionary<Guid, string> _conversationNames = new()
    {
        [_oldestSessionId] = "oldest",
        [_newerSessionId] = "newer",
        [_newestSessionId] = "newest",
        [_archiveSessionId] = "competition",
    };

    /// <summary>
    /// The handout every seeded environment belongs to.
    /// </summary>
    private const string HandoutContentId = "handout-one";

    /// <summary>
    /// The settings all but one conversation ran on, holding a model so a conversation's snapshot has something
    /// to read back off it.
    /// </summary>
    private const string ExaminerConfig =
        /*lang=json,strict*/ """{"generate":{"model":"gemini-3.6-flash","promptText":"be fair"}}""";

    /// <summary>
    /// The same settings written differently, which the database reads as the same json and so the same version.
    /// </summary>
    private const string EquivalentExaminerConfig =
        /*lang=json,strict*/ """{ "generate" : { "promptText" : "be fair", "model" : "gemini-3.6-flash" } }""";

    /// <summary>
    /// How long every seeded model call took.
    /// </summary>
    private const int CallDurationMs = 900;

    /// <summary>
    /// When the seed was written, which every seeded time is measured back from.
    /// </summary>
    private static readonly DateTimeOffset _now = DateTimeOffset.UtcNow;

    /// <summary>
    /// How long each of the seeded drafts took, in the order they were drafted. Distinct per draft, so a projection
    /// that carried one draft's time onto the rest would show.
    /// </summary>
    private static readonly int[] _attemptDurationsMs = [2_400, 1_600];

    /// <inheritdoc/>
    protected override void ConfigureServices(IServiceCollection services)
    {
        // The bounds the queue cuts its page by, left at their defaults, which hold the whole seed.
        services.AddPaginationOptions();

        // The service under test.
        services.AddScoped<IAdminDefenseReviewService, AdminDefenseReviewService>();

        // Writing notes, which several of the queue's marks are read off.
        services.AddScoped<IAdminNoteService, AdminNoteService>();

        // The display names an archive problem is named by.
        services.AddSingleton<IMetadataLocalizationService, MetadataLocalizationService>();
    }

    /// <inheritdoc/>
    protected override async Task SeedDataAsync(MathCompsDbContext context)
    {
        // Two students, so the queue has more than one person's conversations in it, and two reviewers, so their
        // read marks have each other to stay out of.
        context.Users.AddRange(
            new User { Id = _studentId, ExternalId = "ext-student", Username = "Student" },
            new User { Id = _otherStudentId, ExternalId = "ext-other", Username = "Other" },
            new User { Id = _reviewerId, ExternalId = "ext-reviewer", Username = "Reviewer" },
            new User { Id = _otherReviewerId, ExternalId = "ext-reviewer-2", Username = "Second reviewer" });

        // One handout holding both environments.
        var handoutId = Guid.CreateVersion7();
        context.Handouts.Add(new Handout { Id = handoutId, ContentId = HandoutContentId });

        // The two environments the conversations were held against.
        context.HandoutEnvironments.AddRange(
            new HandoutEnvironment { Id = _sharedEnvironmentId, HandoutId = handoutId, ContentId = "problem-one" },
            new HandoutEnvironment { Id = _otherEnvironmentId, HandoutId = handoutId, ContentId = "problem-two" });

        // The competition the archive problem was set in, and the season it ran in.
        var competitionId = Guid.CreateVersion7();
        var seasonId = Guid.CreateVersion7();
        var roundId = Guid.CreateVersion7();
        context.Competitions.Add(new Competition
        {
            Id = competitionId,
            Slug = "1",
            Path = ArchiveCompetitionPath,
            SortPath = ArchiveCompetitionPath,
            SortOrder = 1,
        });
        context.Seasons.Add(new Season { Id = seasonId, StartYear = 2026, EditionNumber = 76 });
        context.Rounds.Add(new Round
        {
            Id = roundId,
            CompetitionId = competitionId,
            SeasonId = seasonId,
            Date = new DateOnly(2026, 9, 28),
        });

        // And the problem itself, which the queue names by where it comes from rather than by an id.
        context.Problems.Add(new Problem
        {
            Id = _archiveProblemId,
            RoundId = roundId,
            Number = 2,
            Slug = ArchiveProblemSlug,
        });

        // Five conversations: two against the shared environment, one against the other, one against an
        // archive problem, and one against nothing.
        // The one held by the other student runs on the same settings written differently, so the version grouping has
        // something to prove; the targetless one runs on the settings two others share, so leaving it out of the
        // grouping is a fact of its own rather than a side effect of it standing alone.
        context.DefenseSessions.AddRange(
            NewSession(_oldestSessionId, _studentId, ExaminerConfig, DefenseTargetKind.Handout),
            NewSession(_newerSessionId, _otherStudentId, EquivalentExaminerConfig, DefenseTargetKind.Handout),
            NewSession(_newestSessionId, _studentId, examinerConfig: "{}", DefenseTargetKind.Handout),
            NewSession(_archiveSessionId, _studentId, ArchiveExaminerConfig, DefenseTargetKind.Problem),
            NewSession(_targetlessSessionId, _studentId, ExaminerConfig, DefenseTargetKind.Handout));

        // Their turns, staggered so the queue has a clear order to put them in. The newest conversation opened
        // twenty days ago and was carried on yesterday, so when it last moved and when it opened disagree and only
        // one of the two puts it at the head of the queue.
        context.DefenseTurns.AddRange(
            NewTurn(_oldestSessionId, TranscriptRole.Examiner, "the opener", 0, _now.AddDays(-10), _oldestOpenerId),
            NewTurn(_oldestSessionId, TranscriptRole.Candidate, "my oldest defense", 1, _now.AddDays(-10)),
            NewTurn(_newerSessionId, TranscriptRole.Examiner, "the opener", 0, _now.AddDays(-5)),
            NewTurn(_newerSessionId, TranscriptRole.Candidate, "my newer defense", 1, _now.AddDays(-5)),
            NewTurn(_newestSessionId, TranscriptRole.Examiner, "the opener", 0, _now.AddDays(-20), _newestOpenerId),
            NewTurn(_newestSessionId, TranscriptRole.Candidate, "my newest defense", 1, _now.AddDays(-1)),
            NewTurn(_newestSessionId, TranscriptRole.Examiner, "her reply", 2, _now.AddDays(-1), _newestReplyId),
            NewTurn(_archiveSessionId, TranscriptRole.Examiner, "the opener", 0, _now.AddDays(-3)),
            NewTurn(_archiveSessionId, TranscriptRole.Candidate, "my competition defense", 1, _now.AddDays(-3)),
            NewTurn(_targetlessSessionId, TranscriptRole.Examiner, "the opener", 0, _now.AddDays(-2)),
            NewTurn(_targetlessSessionId, TranscriptRole.Candidate, "my untargeted defense", 1, _now.AddDays(-2)));

        // The drafts behind the newest conversation's last reply: one the leak-check sent back, and the one that
        // went out. They hang off that reply alone, so the conversations held before the drafts were kept have
        // somewhere to read back empty from. Written in the reverse of the order they were drafted, so a read that
        // takes the database's own order for the run's order has something to get wrong.
        context.DefenseTurnAttempts.AddRange(
            NewAttempt(_newestSessionId, _newestReplyId, attemptIndex: 1, "her reply", leaks: false,
                _attemptDurationsMs[1]),
            NewAttempt(_newestSessionId, _newestReplyId, attemptIndex: 0, "her leaky draft", leaks: true,
                _attemptDurationsMs[0]));

        // Which handout problem each of those conversations was held against, the targetless one deliberately
        // naming nothing.
        context.HandoutEnvironmentDefenses.AddRange(
            NewTarget(_oldestSessionId, _sharedEnvironmentId),
            NewTarget(_newerSessionId, _sharedEnvironmentId),
            NewTarget(_newestSessionId, _otherEnvironmentId));

        // And the archive problem the competition conversation was held against.
        context.ProblemDefenses.Add(new ProblemDefense
        {
            DefenseSessionId = _archiveSessionId,
            ProblemId = _archiveProblemId,
        });

        // What the student made of the newest conversation's last reply, so one of them carries a complaint.
        context.DefenseTurnReports.Add(new DefenseTurnReport
        {
            SessionId = _newestSessionId,
            TurnId = _newestReplyId,
            Categories = [DefenseReportCategory.GaveAway],
            Comment = "she just told me",
            CreatedAt = _now,
            UpdatedAt = _now,
        });

        // And their verdict on a different one, so the complaint and the verdict never sit on the same conversation.
        context.DefenseSessionFeedbacks.Add(new DefenseSessionFeedback
        {
            SessionId = _oldestSessionId,
            Outcome = DefenseOutcome.FoundTheMistake,
            Comment = null,
            CreatedAt = _now,
            UpdatedAt = _now,
        });

        // Commit the seed.
        await context.SaveChangesAsync();
    }

    /// <summary>
    /// The queue reads as one run of conversations, the ones spoken to most recently first, each naming the
    /// environment it was held against. Recency is the last thing said in a conversation rather than the first, so
    /// the one opened twenty days ago and carried on yesterday leads the two opened after it.
    /// </summary>
    [Fact]
    public Task Queue_orders_every_conversation_by_recency() => RunTestAsync(async service =>
    {
        // Read the whole queue
        var queue = await service.GetQueueAsync(_reviewerId, NewFilter(), 1, Language.EN);

        // All four came back, yesterday's leading and the one from ten days ago last
        Assert.Equal(
            [_newestSessionId, _archiveSessionId, _newerSessionId, _oldestSessionId],
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
            var first = await service.GetQueueAsync(_reviewerId, NewFilter(), 1, Language.EN);

            // And then for the rest
            var second = await service.GetQueueAsync(_reviewerId, NewFilter(), 2, Language.EN);

            // The first page holds the two most recent, in order
            Assert.Equal(
                [_newestSessionId, _archiveSessionId],
                first.Items.Select(conversation => conversation.Id));

            // The second carries on with the rest rather than repeating anything
            Assert.Equal(
                [_newerSessionId, _oldestSessionId],
                second.Items.Select(conversation => conversation.Id));

            // And both report the same total, which is what says a third page would hold nothing
            Assert.Equal(4, first.TotalCount);
            Assert.Equal(4, second.TotalCount);
        },
        // A page smaller than the seed, so the queue has a second one to carry on to
        services => services.AddSingleton(
            MsOptions.Create(new PaginationOptions { DefaultPageSize = 2 })));

    /// <summary>
    /// Reading a conversation settles it, a turn arriving afterwards unsettles it again, and putting it back to
    /// unread makes every turn new once more.
    /// </summary>
    [Fact]
    public Task Reading_a_conversation_holds_only_until_its_next_turn() => RunTestAsync(async service =>
    {
        // Every turn of the newest conversation is unread to begin with
        Assert.Equal(3, (await GetConversationAsync(service, _newestSessionId)).UnreadTurnCount);

        // Read it
        await service.MarkReadAsync(_reviewerId, _newestSessionId);

        // The conversation as it stands after the read
        var read = await GetConversationAsync(service, _newestSessionId);

        // Nothing in it is new now, and the read left a stamp behind
        Assert.Equal(0, read.UnreadTurnCount);
        Assert.NotNull(read.ReadAt);

        // The student carries the conversation on
        await QueryAsync(async context =>
        {
            // One more turn, later than the stamp the read left
            context.DefenseTurns.Add(NewTurn(
                _newestSessionId, TranscriptRole.Candidate, "one more thing", 3, DateTimeOffset.UtcNow));

            // Commit it
            await context.SaveChangesAsync();
        });

        // Which brings it back with exactly the one new turn against it
        Assert.Equal(1, (await GetConversationAsync(service, _newestSessionId)).UnreadTurnCount);

        // Read it a second time
        await service.MarkReadAsync(_reviewerId, _newestSessionId);

        // The conversation after the second read
        var reread = await GetConversationAsync(service, _newestSessionId);

        // Which moves the stamp on rather than leaving it where the first pass stopped
        Assert.Equal(0, reread.UnreadTurnCount);
        Assert.True(reread.ReadAt > read.ReadAt);

        // Put it back to unread
        await service.MarkUnreadAsync(_reviewerId, _newestSessionId);

        // The conversation after it was put back
        var unread = await GetConversationAsync(service, _newestSessionId);

        // Which makes all four turns new again, and leaves no stamp behind
        Assert.Equal(4, unread.UnreadTurnCount);
        Assert.Null(unread.ReadAt);
    });

    /// <summary>
    /// Picking a conversation up from one of its turns leaves that turn and everything after it new, and settles
    /// the ones before it. Naming a turn further down settles what stood unread above it, since where a reader
    /// picks up is one place rather than a run of them.
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
                    _newestSessionId, TranscriptRole.Candidate, "one more thing", 3,
                    _now.AddHours(-12), followUpId),
                NewTurn(
                    _newestSessionId, TranscriptRole.Examiner, "her last word", 4,
                    _now.AddHours(-6), lastReplyId));

            // Commit them
            await context.SaveChangesAsync();
        });

        // Read the whole thing
        await service.MarkReadAsync(_reviewerId, _newestSessionId);

        // Pick it back up from the student's follow-up
        await service.MarkUnreadFromAsync(_reviewerId, _newestSessionId, followUpId);

        // The conversation as it stands after that
        var fromFollowUp = await GetConversationAsync(service, _newestSessionId);

        // Which leaves the follow-up and the reply after it new
        Assert.Equal(2, fromFollowUp.UnreadTurnCount);

        // When the turn before the follow-up was recorded, read back rather than compared against the seeded
        // stamp, which carries finer ticks than the column keeps
        var precedingAt = await QueryValueAsync(context =>
            context.DefenseTurns
                .Where(turn => turn.Id == _newestReplyId)
                .Select(turn => turn.CreatedAt)
                .SingleAsync());

        // Which is where the reading stops, rather than a moment cut just under the follow-up: that is what
        // keeps the stamp meaning a moment somebody's reading actually stopped
        Assert.Equal(precedingAt, fromFollowUp.ReadAt);

        // Pick it up from the reply instead
        await service.MarkUnreadFromAsync(_reviewerId, _newestSessionId, lastReplyId);

        // Which moves where the reading stops down to it, leaving only it new
        Assert.Equal(1, (await GetConversationAsync(service, _newestSessionId)).UnreadTurnCount);
    });

    /// <summary>
    /// Picking a conversation up from the turn it opens on leaves nothing read at all, which is the state a
    /// conversation nobody has opened is already in.
    /// </summary>
    [Fact]
    public Task Picking_a_conversation_up_from_its_opener_leaves_no_stamp() => RunTestAsync(async service =>
    {
        // Read the whole thing
        await service.MarkReadAsync(_reviewerId, _newestSessionId);

        // Pick it back up from the opener, which nothing precedes
        await service.MarkUnreadFromAsync(_reviewerId, _newestSessionId, _newestOpenerId);

        // The conversation as it stands after that
        var reopened = await GetConversationAsync(service, _newestSessionId);

        // Which makes every turn new again and drops the stamp rather than leaving one nothing sits before
        Assert.Equal(3, reopened.UnreadTurnCount);
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
        await service.MarkReadAsync(_reviewerId, _newestSessionId);

        // Pick it up from the reply, which the message before it shares a moment with
        await service.MarkUnreadFromAsync(_reviewerId, _newestSessionId, _newestReplyId);

        // Both of them stand new, the stamp having landed on the opener before the pair
        Assert.Equal(2, (await GetConversationAsync(service, _newestSessionId)).UnreadTurnCount);
    });

    /// <summary>
    /// A reader picks a conversation up from one of its own turns. One belonging to another conversation is
    /// refused rather than dropping the stamp for want of anything before it.
    /// </summary>
    [Fact]
    public Task Picking_up_from_another_conversations_turn_is_refused() => RunTestAsync(async service =>
    {
        // Read the newest conversation
        await service.MarkReadAsync(_reviewerId, _newestSessionId);

        // Picking it up from a turn the oldest one holds
        await Assert.ThrowsAsync<AdminReviewTargetException>(
            () => service.MarkUnreadFromAsync(_reviewerId, _newestSessionId, _oldestOpenerId));

        // And from a turn nothing was seeded under at all
        await Assert.ThrowsAsync<AdminReviewTargetException>(
            () => service.MarkUnreadFromAsync(
                _reviewerId, _newestSessionId, Guid.Parse("00000000-0000-0000-0000-0000000000bf")));

        // Neither of which moved the stamp the conversation already had
        Assert.Equal(0, (await GetConversationAsync(service, _newestSessionId)).UnreadTurnCount);
    });

    /// <summary>
    /// Marking a set settles every conversation in it at once, an id naming none is passed over rather than
    /// taking the set down with it, and putting the set back leaves no stamp behind.
    /// </summary>
    [Fact]
    public Task Marking_a_set_settles_every_conversation_in_it() => RunTestAsync(async service =>
    {
        // An id under which the database holds nothing, riding along with two real ones
        var missingId = Guid.Parse("00000000-0000-0000-0000-0000000000ff");

        // Mark the two real conversations read, alongside one that is gone and one named twice
        await service.MarkManyAsync(
            _reviewerId, [_newestSessionId, _oldestSessionId, missingId, _newestSessionId], read: true);

        // Both real ones settled, rather than the missing id refusing the whole set
        Assert.Equal(0, (await GetConversationAsync(service, _newestSessionId)).UnreadTurnCount);
        Assert.NotNull((await GetConversationAsync(service, _oldestSessionId)).ReadAt);

        // Put the set back
        await service.MarkManyAsync(_reviewerId, [_newestSessionId, _oldestSessionId], read: false);

        // The newest conversation as it stands after the set was put back
        var newest = await GetConversationAsync(service, _newestSessionId);

        // Which leaves no stamp on either, so every turn is new again
        Assert.Null(newest.ReadAt);
        Assert.Equal(3, newest.UnreadTurnCount);
        Assert.Null((await GetConversationAsync(service, _oldestSessionId)).ReadAt);
    });

    /// <summary>
    /// One reviewer's set mark is theirs alone: it settles nothing for anybody else, and taking it back leaves
    /// another reviewer's own stamps standing.
    /// </summary>
    [Fact]
    public Task Marking_a_set_reaches_only_the_reviewer_who_marked_it() => RunTestAsync(async service =>
    {
        // The other reviewer has read the newest conversation
        await service.MarkReadAsync(_otherReviewerId, _newestSessionId);

        // This reviewer marks the same set read
        await service.MarkManyAsync(_reviewerId, [_newestSessionId], read: true);

        // And puts it straight back
        await service.MarkManyAsync(_reviewerId, [_newestSessionId], read: false);

        // The other reviewer's own stamp survived both
        Assert.NotNull((await GetConversationAsync(service, _newestSessionId, _otherReviewerId)).ReadAt);
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
            _reviewerId, NewFilter() with { Unread = true }, 1, Language.EN);

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
        await service.MarkReadAsync(_reviewerId, _newestSessionId);

        // Their own unread queue
        var read = await service.GetQueueAsync(
            _reviewerId, NewFilter() with { Unread = true }, 1, Language.EN);

        // Which settles the one they read
        Assert.Equal(3, read.TotalCount);

        // The other reviewer's, who has read nothing
        var other = await service.GetQueueAsync(
            _otherReviewerId, NewFilter() with { Unread = true }, 1, Language.EN);

        // Where all four still stand
        Assert.Equal(4, other.TotalCount);

        // And the detail carries each reviewer their own stamp
        Assert.NotNull((await service.GetDetailAsync(_reviewerId, _newestSessionId, Language.EN)).ReadAt);
        Assert.Null((await service.GetDetailAsync(_otherReviewerId, _newestSessionId, Language.EN)).ReadAt);

        // The other reviewer puts it back to unread, which takes only their own stamp, and they never had one
        await service.MarkUnreadAsync(_otherReviewerId, _newestSessionId);

        // So the first reviewer's still stands
        Assert.NotNull((await service.GetDetailAsync(_reviewerId, _newestSessionId, Language.EN)).ReadAt);
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
            _reviewerId, NewFilter() with { PromptVersion = shared.Version }, 1, Language.EN);

        // Which leaves exactly the two that ran on it
        Assert.Equal(2, queue.TotalCount);
    });

    /// <summary>
    /// A queue row reports what the conversation holds: the student who held it, their most recent message rather
    /// than the examiner's or an earlier one of their own, how many turns it ran to, what has been written about
    /// it, and which of the two things a student can leave behind it carries.
    /// </summary>
    [Fact]
    public Task A_queue_row_reports_what_the_conversation_holds() => RunTestAsync(async service =>
    {
        // Write a note against one of its replies
        await QueryAsync<IAdminNoteService>((_, notes) => notes.CreateAsync(
            _reviewerId, _newestSessionId, _newestReplyId, "she gave it away", null));

        // Take the conversation past the student's opening message, so an earlier one of theirs can't win
        await QueryAsync(async context =>
        {
            // A second student turn, after the reply the seed left
            context.DefenseTurns.Add(NewTurn(
                _newestSessionId, TranscriptRole.Candidate, "and here is my fix", 3, _now));

            // Commit it
            await context.SaveChangesAsync();
        });

        // Read the row back
        var row = await GetConversationAsync(service, _newestSessionId);

        // It names who held the conversation
        Assert.Equal("Student", row.User.Username);

        // Reads what the student last said, not the examiner's reply nor the message they opened with
        Assert.Equal("and here is my fix", row.LastStudentMessage);

        // Counts every turn in it
        Assert.Equal(4, row.TurnCount);

        // Carries the note
        Assert.Equal(1, row.NoteCount);

        // And reports the complaint the student left against one of its replies, with no verdict on the whole of it
        Assert.True(row.HasStudentReport);
        Assert.False(row.HasStudentFeedback);

        // The conversation carrying the other of the two
        var answered = await GetConversationAsync(service, _oldestSessionId);

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
            var student = await context.Users.SingleAsync(user => user.Id == _studentId);

            // Marked gone the way deletion marks it, which leaves the name standing
            student.IsDeleted = true;

            // Commit it
            await context.SaveChangesAsync();
        });

        // Read the row back
        var row = await GetConversationAsync(service, _newestSessionId);

        // It holds nobody the review can name
        Assert.Null(row.User.Username);
    });

    /// <summary>
    /// Each filter narrows the queue to what it names, and nothing else. Run together rather than one test each
    /// because they are eleven near-identical clauses written in one sitting, which is exactly where an inverted one
    /// hides; comparing the whole set at once still names which clause was wrong.
    /// </summary>
    [Fact]
    public Task Each_filter_narrows_the_queue_to_what_it_names() => RunTestAsync(async service =>
    {
        // Something written about one of them, so the notes filter has both directions to tell apart
        await QueryAsync<IAdminNoteService>((_, notes) => notes.CreateAsync(
            _reviewerId, _newestSessionId, _newestReplyId, "worth a second look", null));

        // And that same conversation carried on just now, so the shortest period a filter can name has one
        // conversation to keep and two to drop rather than nothing to say either way about
        await QueryAsync(async context =>
        {
            // One more turn, stamped as this moment
            context.DefenseTurns.Add(NewTurn(
                _newestSessionId, TranscriptRole.Candidate, "one more thing", 3, DateTimeOffset.UtcNow));

            // Commit it
            await context.SaveChangesAsync();
        });

        // Every filter paired with how many of the seeded conversations it should leave and which they are. Naming
        // them is what tells two filters apart that happen to leave the same number, which is where a clause wired
        // to its neighbour's column would otherwise sit unnoticed
        (string Description, AdminDefenseQueueFilter Filter, int Count, string Left)[] cases =
        [
            ("one student holds three of the four",
                NewFilter() with { UserId = _studentId }, 3, "newest, competition, oldest"),
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
        ];

        // What each filter left, labelled so a mismatch says which clause was wrong
        var actual = new List<string>();

        // One queue read per filter
        foreach (var (description, filter, _, _) in cases)
        {
            // What this one leaves
            var queue = await service.GetQueueAsync(_reviewerId, filter, 1, Language.EN);

            // Recorded under its label, by the pager's count and by the conversations on the page
            actual.Add($"{description}: {queue.TotalCount} ({Describe(queue.Items)})");
        }

        // Compare the whole set at once
        Assert.Equal([.. cases.Select(one => $"{one.Description}: {one.Count} ({one.Left})")], actual);
    });

    /// <summary>
    /// The whole conversation reads back with everything the examiner held: the problem and its reference, the
    /// settings snapshot as readable json rather than a string, the turns in the order they were said, and the
    /// student's verdict on all of it.
    /// </summary>
    [Fact]
    public Task The_detail_carries_the_whole_conversation_and_what_it_ran_on() => RunTestAsync(async service =>
    {
        // Read the conversation the student answered for
        var detail = await service.GetDetailAsync(_reviewerId, _oldestSessionId, Language.EN);

        // Everything the examiner was working from
        Assert.Equal("a problem", detail.Statement);
        Assert.Equal("a reference", detail.Reference);

        // Its settings snapshot reads as json, still holding the model the conversation ran on. Reading a property
        // off it here is what says the element outlived the document it was parsed out of
        Assert.Equal(
            "gemini-3.6-flash",
            detail.ExaminerConfig.GetProperty("generate").GetProperty("model").GetString());

        // The turns come back in the order they were said, the examiner's opener ahead of the student's answer
        Assert.Equal(
            ["the opener", "my oldest defense"],
            detail.Turns.Select(turn => turn.Content));

        // Along with what the student made of the conversation as a whole
        Assert.Equal(DefenseOutcome.FoundTheMistake, detail.Feedback?.Outcome);
    });

    /// <summary>
    /// The detail carries every draft behind a reply, attributed to the reply it was made for and in the order it was
    /// drafted, each with the calls that wrote and judged it. The review surface groups them by reply and reads the
    /// last of a group as the one the student saw, so an attribution or an order that slipped would tell a false
    /// story about what the examiner did.
    /// </summary>
    [Fact]
    public Task The_detail_carries_every_draft_behind_a_reply() => RunTestAsync(async service =>
    {
        // Read the conversation whose last reply took two drafts
        var detail = await service.GetDetailAsync(_reviewerId, _newestSessionId, Language.EN);

        // Both came back in the order they were drafted
        Assert.Equal(["her leaky draft", "her reply"], detail.Attempts.Select(attempt => attempt.Reply));

        // Each against the reply it was made for, which is what the surface groups them by
        Assert.All(detail.Attempts, attempt => Assert.Equal(_newestReplyId, attempt.TurnId));

        // The rejected one carries what the guard caught, the part the student never saw
        Assert.True(detail.Attempts[0].Leaks);
        Assert.Equal("the counterexample", detail.Attempts[0].WhatLeaked);

        // And each carries the calls it made, which the turn's single figure can't break down
        Assert.All(
            detail.Attempts,
            attempt => Assert.Equal(
                [ExaminerStep.Generate, ExaminerStep.LeakCheck],
                attempt.Calls.Select(call => call.Step).Order()));

        // Along with how long each draft and each of its calls took, the axis a slow reply is traced along
        Assert.Equal(_attemptDurationsMs, detail.Attempts.Select(attempt => attempt.DurationMs));
        Assert.All(
            detail.Attempts.SelectMany(attempt => attempt.Calls),
            call => Assert.Equal(CallDurationMs, call.DurationMs));
    });

    /// <summary>
    /// A conversation held before the drafts were kept reads back holding none, rather than failing on their absence.
    /// Every conversation already in the database is one of those, so the empty case is the ordinary one for a while
    /// yet, and it has to reach the review surface as "nothing to show" rather than as an error.
    /// </summary>
    [Fact]
    public Task The_detail_holds_no_drafts_for_a_conversation_from_before_they_were_kept() =>
        RunTestAsync(async service =>
    {
        // Read a conversation seeded with turns and nothing recorded behind them
        var detail = await service.GetDetailAsync(_reviewerId, _oldestSessionId, Language.EN);

        // Its turns came back, and it simply holds no drafts
        Assert.NotEmpty(detail.Turns);
        Assert.Empty(detail.Attempts);
    });

    /// <summary>
    /// The detail carries the notes written about that conversation and no others, newest first, each marked as the
    /// reading reviewer's own or somebody else's.
    /// </summary>
    [Fact]
    public Task The_detail_carries_only_its_own_notes_newest_first() => RunTestAsync(async service =>
    {
        // Two readings of one conversation by different reviewers, and one of another, so a note that belongs
        // elsewhere has somewhere to leak in from
        await QueryAsync(async context =>
        {
            // The three notes, stamped apart so newest-first has an order to hold
            context.AdminNotes.AddRange(
                NewNote(_reviewerId, _newestSessionId, "my earlier reading", _now.AddHours(-2)),
                NewNote(_otherReviewerId, _newestSessionId, "a second opinion", _now.AddHours(-1)),
                NewNote(_reviewerId, _newerSessionId, "about a different conversation", _now.AddHours(-3)));

            // Commit them
            await context.SaveChangesAsync();
        });

        // Read the conversation the first two were written about
        var detail = await service.GetDetailAsync(_reviewerId, _newestSessionId, Language.EN);

        // Only its own two come back, the later reading ahead of the earlier
        Assert.Equal(
            ["a second opinion", "my earlier reading"],
            detail.Notes.Select(note => note.Content));

        // Each under whoever wrote it
        Assert.Equal(
            ["Second reviewer", "Reviewer"],
            detail.Notes.Select(note => note.Author.Username));

        // And marked as the reading reviewer's own only where they are the author
        Assert.Equal([false, true], detail.Notes.Select(note => note.IsOwn));
    });

    /// <summary>
    /// A conversation held against an archive problem reaches the queue alongside the handout ones, named by the
    /// competition it was set in rather than by an id the reviewer's side has nothing to resolve.
    /// </summary>
    [Fact]
    public Task An_archive_problem_reads_back_named_by_where_it_comes_from() => RunTestAsync(async service =>
    {
        // The whole queue, which holds conversations of both kinds
        var queue = await service.GetQueueAsync(_reviewerId, NewFilter(), 1, Language.EN);

        // The competition one, which the queue carries as an archive problem rather than a handout one
        var conversation = Assert.Single(
            queue.Items.Where(candidate => candidate.Id == _archiveSessionId));

        // Named by the problem's slug and where the problem comes from
        var target = Assert.IsType<NamedProblemTarget>(conversation.Target);
        Assert.Equal(ArchiveProblemSlug, target.Slug);

        // Which is every competition down to the one that set it, each named in the language asked for
        Assert.Equal(
            ["MathComps", "Advanced", "September"],
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
            _reviewerId, NewFilter() with { ProblemSlug = ArchiveProblemSlug }, 1, Language.EN);

        // Which leaves the one conversation held against it
        Assert.Equal([_archiveSessionId], queue.Items.Select(conversation => conversation.Id));
    });

    /// <summary>
    /// Opening a competition conversation names its problem the same way the queue does. The detail builds its
    /// own projection over the same columns, so the queue naming one is no evidence that the modal does.
    /// </summary>
    [Fact]
    public Task The_detail_of_an_archive_conversation_names_where_its_problem_comes_from() =>
        RunTestAsync(async service =>
        {
            // The competition conversation, read in full
            var detail = await service.GetDetailAsync(_reviewerId, _archiveSessionId, Language.EN);

            // Which names an archive problem rather than a handout one
            var target = Assert.IsType<NamedProblemTarget>(detail.Target);
            Assert.Equal(ArchiveProblemSlug, target.Slug);

            // Which is every competition down to the one that set it, each named in the language asked for
            Assert.Equal(
                ["MathComps", "Advanced", "September"],
                target.Source.Competition.Select(competition => competition.DisplayName));

            // Along with the season's own year and the problem's place in the competition
            Assert.Equal(2026, target.Source.StartYear);
            Assert.Equal(2, target.Source.Number);
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
            [_studentId, _otherStudentId],
            options.Users.Select(option => option.User.Id));
        Assert.Equal([3, 1], options.Users.Select(option => option.ConversationCount));

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
    /// A conversation held against no environment is out of the reviewer's reach altogether: it never reaches the
    /// queue, which has nothing to name it by, and asking for it outright reads as absent rather than opening it.
    /// </summary>
    [Fact]
    public Task A_conversation_held_against_no_environment_stays_out_of_reach() => RunTestAsync(async service =>
    {
        // Read the whole queue, narrowed by nothing
        var queue = await service.GetQueueAsync(_reviewerId, NewFilter(), 1, Language.EN);

        // The four that name a problem are all of it, though the targetless one moved more recently than two
        Assert.Equal(4, queue.TotalCount);
        Assert.DoesNotContain(_targetlessSessionId, queue.Items.Select(conversation => conversation.Id));

        // And asking for it by name is refused the same way an id nothing was seeded under is
        await Assert.ThrowsAsync<DefenseSessionNotFoundException>(
            () => service.GetDetailAsync(_reviewerId, _targetlessSessionId, Language.EN));
    });

    /// <summary>
    /// A conversation that isn't there can't be read or marked, rather than quietly passing for done.
    /// </summary>
    [Fact]
    public Task A_missing_conversation_is_refused_by_every_read_and_mark() => RunTestAsync(async service =>
    {
        // An id nothing was seeded under
        var missingId = Guid.Parse("00000000-0000-0000-0000-0000000000ff");

        // Reading it
        await Assert.ThrowsAsync<DefenseSessionNotFoundException>(
            () => service.GetDetailAsync(_reviewerId, missingId, Language.EN));

        // Marking it read
        await Assert.ThrowsAsync<DefenseSessionNotFoundException>(
            () => service.MarkReadAsync(_reviewerId, missingId));

        // Putting it back to unread
        await Assert.ThrowsAsync<DefenseSessionNotFoundException>(
            () => service.MarkUnreadAsync(_reviewerId, missingId));

        // And picking it up from a turn, which is refused for the conversation before the turn is looked at
        await Assert.ThrowsAsync<DefenseSessionNotFoundException>(
            () => service.MarkUnreadFromAsync(_reviewerId, missingId, _newestReplyId));
    });

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
    /// <param name="reviewerId">Whose marks the row is read against; the usual reviewer unless named.</param>
    /// <returns>Its row.</returns>
    private static async Task<AdminDefenseConversationDto> GetConversationAsync(
        IAdminDefenseReviewService service, Guid sessionId, Guid? reviewerId = null)
    {
        // The whole queue, since a row only exists as part of it
        var queue = await service.GetQueueAsync(reviewerId ?? _reviewerId, NewFilter(), 1, Language.EN);

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
        new(false, null, false, false, null, null, null, null, null, null);

    /// <summary>
    /// Builds one seeded conversation, held against a handout environment.
    /// </summary>
    /// <param name="sessionId">The conversation's identifier.</param>
    /// <param name="userId">Who held it.</param>
    /// <param name="examinerConfig">The settings it ran on.</param>
    /// <param name="targetKind">Which kind of problem it was held against.</param>
    /// <returns>The conversation, ready to add.</returns>
    private static DefenseSession NewSession(
        Guid sessionId, Guid userId, string examinerConfig, DefenseTargetKind targetKind) => new()
        {
            Id = sessionId,
            UserId = userId,
            TargetKind = targetKind,
            ProblemStatement = "a problem",
            ProblemReference = "a reference",
            ExaminerConfig = examinerConfig,
            CreatedAt = _now.AddDays(-30),
        };

    /// <summary>
    /// Builds the link saying which handout environment a seeded conversation was held against.
    /// </summary>
    /// <param name="sessionId">The conversation.</param>
    /// <param name="handoutEnvironmentId">The handout environment it was held against.</param>
    /// <returns>The link, ready to add.</returns>
    private static HandoutEnvironmentDefense NewTarget(Guid sessionId, Guid handoutEnvironmentId) => new()
    {
        DefenseSessionId = sessionId,
        HandoutEnvironmentId = handoutEnvironmentId,
    };

    /// <summary>
    /// Builds one note about a conversation as a whole, stamped when the test says rather than now, so a set of them
    /// has an order that doesn't depend on how fast they were written.
    /// </summary>
    /// <param name="authorId">The reviewer who wrote it.</param>
    /// <param name="sessionId">The conversation it is about.</param>
    /// <param name="content">What it says.</param>
    /// <param name="writtenAt">When it was written.</param>
    /// <returns>The note, ready to add.</returns>
    private static AdminNote NewNote(
        Guid authorId, Guid sessionId, string content, DateTimeOffset writtenAt) => new()
        {
            AuthorId = authorId,
            SessionId = sessionId,
            TurnId = null,
            Content = content,
            Category = null,
            ResolvedAt = null,
            CreatedAt = writtenAt,
            UpdatedAt = writtenAt,
        };

    /// <summary>
    /// Builds one seeded turn.
    /// </summary>
    /// <param name="sessionId">The conversation the turn belongs to.</param>
    /// <param name="role">Who authored the turn.</param>
    /// <param name="content">The turn's text.</param>
    /// <param name="sequence">The turn's position in the conversation.</param>
    /// <param name="createdAt">When the turn was recorded.</param>
    /// <param name="turnId">The turn's identifier, minted when the test doesn't need to name it.</param>
    /// <returns>The turn, ready to add.</returns>
    private static DefenseTurn NewTurn(
        Guid sessionId, TranscriptRole role, string content, int sequence, DateTimeOffset createdAt,
        Guid? turnId = null) => new()
        {
            Id = turnId ?? Guid.CreateVersion7(),
            SessionId = sessionId,
            Role = role,
            Content = content,
            Sequence = sequence,
            CreatedAt = createdAt,
        };

    /// <summary>
    /// Builds one seeded draft, carrying the calls that wrote and judged it.
    /// </summary>
    /// <param name="sessionId">The conversation the draft was made in.</param>
    /// <param name="turnId">The reply it was drafted for.</param>
    /// <param name="attemptIndex">Its place in that reply's run.</param>
    /// <param name="reply">The drafted text.</param>
    /// <param name="leaks">Whether the leak-check flagged it, which is what sends a draft back.</param>
    /// <param name="durationMs">How long the draft took end to end.</param>
    /// <returns>The draft, ready to add.</returns>
    private static DefenseTurnAttempt NewAttempt(
        Guid sessionId, Guid turnId, int attemptIndex, string reply, bool leaks, int durationMs)
    {
        // The draft and every verdict passed on it, clean but for the leak the test asks for.
        var attempt = new DefenseTurnAttempt
        {
            SessionId = sessionId,
            TurnId = turnId,
            AttemptIndex = attemptIndex,
            Reply = reply,
            RevisionNote = attemptIndex == 0 ? "" : "REVISION REQUIRED — you gave away the counterexample.",
            MathHolds = true,
            MathCorrection = "",
            Leaks = leaks,
            WhatLeaked = leaks ? "the counterexample" : "",
            WithholdsClose = false,
            Established = "",
            SwitchesLanguage = false,
            CandidateLanguage = "English",
            IsSafeFallback = false,
            CreatedAt = _now,
            DurationMs = durationMs,
        };

        // The calls behind it, keyed off the draft's own client-side id.
        attempt.Calls = [NewCall(attempt.Id, ExaminerStep.Generate), NewCall(attempt.Id, ExaminerStep.LeakCheck)];

        // Hand it back with them attached.
        return attempt;
    }

    /// <summary>
    /// Builds one seeded model call.
    /// </summary>
    /// <param name="attemptId">The draft that made it.</param>
    /// <param name="step">The step it ran.</param>
    /// <returns>The call, ready to hang off a draft.</returns>
    private static DefenseAttemptCall NewCall(Guid attemptId, ExaminerStep step) => new()
    {
        AttemptId = attemptId,
        Step = step,
        Model = "fake/model",
        ReasoningEffort = "low",
        Cost = 0.01m,
        PromptTokens = 100,
        CompletionTokens = 20,
        ReasoningTokens = 5,
        CachedPromptTokens = 0,
        DurationMs = CallDurationMs,
    };
}

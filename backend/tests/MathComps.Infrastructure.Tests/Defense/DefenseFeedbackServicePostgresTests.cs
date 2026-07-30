using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Options;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Defense;
using MathComps.Infrastructure.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Category = MathComps.Domain.EfCoreEntities.DefenseReportCategory;

namespace MathComps.Infrastructure.Tests.Defense;

/// <summary>
/// Integration tests for <see cref="DefenseFeedbackService"/> against a real PostgreSQL database: ownership
/// isolation, what each write refuses, that both kinds of feedback are revised rather than accumulated, that both
/// can be taken back, and the deletion rules the storage design turns on — a report dies with the reply it is
/// against, and both kinds die with the conversation.
/// </summary>
/// <param name="fixture">The shared PostgreSQL container fixture.</param>
public class DefenseFeedbackServicePostgresTests(PostgresContainerFixture fixture)
    : PostgresTestBase<IDefenseFeedbackService>(fixture)
{
    /// <summary>
    /// The user who owns the seeded sessions.
    /// </summary>
    private static readonly Guid _ownerId = Guid.Parse("00000000-0000-0000-0000-000000000001");

    /// <summary>
    /// A second user, for the ownership-isolation checks.
    /// </summary>
    private static readonly Guid _otherId = Guid.Parse("00000000-0000-0000-0000-000000000002");

    /// <summary>
    /// The seeded session every test files feedback against.
    /// </summary>
    private static readonly Guid _sessionId = Guid.Parse("00000000-0000-0000-0000-0000000000a1");

    /// <summary>
    /// A second conversation the same user holds, so a report can be pointed at a reply from the wrong one.
    /// </summary>
    private static readonly Guid _otherSessionId = Guid.Parse("00000000-0000-0000-0000-0000000000a2");

    /// <summary>
    /// The seeded examiner reply, the one a report can name.
    /// </summary>
    private static readonly Guid _replyId = Guid.Parse("00000000-0000-0000-0000-0000000000b1");

    /// <summary>
    /// The seeded opener, a second examiner turn that carries its own report.
    /// </summary>
    private static readonly Guid _openerId = Guid.Parse("00000000-0000-0000-0000-0000000000b0");

    /// <summary>
    /// The seeded student turn, which no report may name.
    /// </summary>
    private static readonly Guid _studentTurnId = Guid.Parse("00000000-0000-0000-0000-0000000000b2");

    /// <summary>
    /// An examiner reply from the other conversation, which a report against this one may not reach.
    /// </summary>
    private static readonly Guid _otherSessionReplyId = Guid.Parse("00000000-0000-0000-0000-0000000000b3");

    /// <summary>
    /// The position of the seeded examiner reply, which a rewind cuts back past.
    /// </summary>
    private const int ReplySequence = 2;

    /// <inheritdoc/>
    protected override void ConfigureServices(IServiceCollection services)
    {
        // The only cap this service reads; a tight one so the length guard is cheap to trip.
        services.Configure<DefenseLimits>(limits => limits.MaxFeedbackCommentChars = 50);

        // Serializes a user's concurrent writes.
        services.AddSingleton<IDefenseUserTurnGate, DefenseUserTurnGate>();

        // The service under test.
        services.AddScoped<IDefenseFeedbackService, DefenseFeedbackService>();
    }

    /// <inheritdoc/>
    protected override async Task SeedDataAsync(MathCompsDbContext context)
    {
        // Two users, so ownership isolation can be checked.
        context.Users.AddRange(
            new User { Id = _ownerId, ExternalId = "ext-owner", DisplayName = "Owner" },
            new User { Id = _otherId, ExternalId = "ext-other", DisplayName = "Other" });

        // Two conversations belonging to the owner, the first shaped like a real one: opener, the student,
        // the reply.
        context.DefenseSessions.AddRange(NewSession(_sessionId), NewSession(_otherSessionId));

        // The turns of the conversation under test.
        context.DefenseTurns.AddRange(
            NewTurn(_openerId, _sessionId, TranscriptRole.Examiner, "the opener", sequence: 0),
            NewTurn(_studentTurnId, _sessionId, TranscriptRole.Candidate, "my defense", sequence: 1),
            NewTurn(_replyId, _sessionId, TranscriptRole.Examiner, "her reply", ReplySequence));

        // A lone reply in the other conversation, for the cross-conversation check.
        context.DefenseTurns.Add(NewTurn(
            _otherSessionReplyId, _otherSessionId, TranscriptRole.Examiner, "elsewhere", sequence: 0));

        // Commit the seed.
        await context.SaveChangesAsync();
    }

    /// <summary>
    /// A report lands against the reply it names, carrying every way it went wrong (each way only once, however
    /// many times it was named) and the student's own account of it.
    /// </summary>
    [Fact]
    public Task Report_persists_its_reply_categories_and_comment() => RunTestAsync(async service =>
    {
        // Report the examiner's reply on two counts, one of them named twice
        await service.ReportTurnAsync(
            _ownerId, _sessionId, _replyId,
            [Category.SaidSomethingWrong, Category.Misunderstood, Category.SaidSomethingWrong],
            "n=1 works fine");

        // Read back the reports the session holds
        await QueryAsync(async context =>
        {
            // The one report just recorded
            var report = await context.DefenseTurnReports.SingleAsync();

            // It hangs off both the conversation and the reply within it
            Assert.Equal(_sessionId, report.SessionId);
            Assert.Equal(_replyId, report.TurnId);

            // It holds each named way against the reply exactly once
            Assert.Equal([Category.SaidSomethingWrong, Category.Misunderstood], report.Categories);

            // And what the student said in their own words
            Assert.Equal("n=1 works fine", report.Comment);
        });
    });

    /// <summary>
    /// A comment is stored as the text it carries: whitespace around it goes, and one made of nothing else is
    /// stored as no comment at all, so a blank box and an untouched one read alike.
    /// </summary>
    [Fact]
    public Task Report_stores_a_comment_as_the_text_it_carries() => RunTestAsync(async service =>
    {
        // Report a reply with a comment box holding nothing but spaces
        await service.ReportTurnAsync(_ownerId, _sessionId, _replyId, [Category.Tone], "   ");

        // The comment that report was stored with
        var blank = await QueryValueAsync(context =>
            context.DefenseTurnReports.Select(report => report.Comment).SingleAsync());

        // Nothing was said, so nothing is stored
        Assert.Null(blank);

        // Revise it to something with whitespace around it
        await service.ReportTurnAsync(_ownerId, _sessionId, _replyId, [Category.Tone], "  she was rude  ");

        // The comment it carries now
        var written = await QueryValueAsync(context =>
            context.DefenseTurnReports.Select(report => report.Comment).SingleAsync());

        // Which is what the student wrote, without the padding
        Assert.Equal("she was rude", written);
    });

    /// <summary>
    /// Reporting a reply again revises the one report rather than adding a second, keeping the first stamp so the
    /// row still says when the student first complained.
    /// </summary>
    [Fact]
    public Task Reporting_a_reply_again_revises_the_one_report() => RunTestAsync(async service =>
    {
        // Report the reply once
        await service.ReportTurnAsync(_ownerId, _sessionId, _replyId, [Category.SaidSomethingWrong], "which case?");

        // The identity and stamps the first report was written with
        var first = await QueryValueAsync(context => context.DefenseTurnReports
            .Select(report => new { report.Id, report.CreatedAt, report.UpdatedAt })
            .SingleAsync());

        // Change what is held against it
        await service.ReportTurnAsync(
            _ownerId, _sessionId, _replyId, [Category.GaveAway, Category.Tone], "she just told me");

        // Read back what the reply now carries
        await QueryAsync(async context =>
        {
            // Still exactly one report
            var report = await context.DefenseTurnReports.SingleAsync();

            // Carrying the revision rather than the original
            Assert.Equal([Category.GaveAway, Category.Tone], report.Categories);
            Assert.Equal("she just told me", report.Comment);

            // It is the same row throughout, so its time-ordered key still says when it first appeared
            Assert.Equal(first.Id, report.Id);

            // The first stamp stands
            Assert.Equal(first.CreatedAt, report.CreatedAt);

            // And the revision moved the second past it
            Assert.True(report.UpdatedAt > first.UpdatedAt);
        });
    });

    /// <summary>
    /// A report is one per reply, not one per conversation: the unique index sits on the reply, so reporting a
    /// second one stands beside the first rather than revising it.
    /// </summary>
    [Fact]
    public Task Every_reply_carries_its_own_report() => RunTestAsync(async service =>
    {
        // Report the opener
        await service.ReportTurnAsync(_ownerId, _sessionId, _openerId, [Category.Tone], comment: null);

        // Report the reply
        await service.ReportTurnAsync(
            _ownerId, _sessionId, _replyId, [Category.MissedTheMistake], comment: null);

        // The replies each report names
        var reported = await QueryValueAsync(context => context.DefenseTurnReports
            .Select(report => report.TurnId)
            .ToListAsync());

        // Each reply carries its own
        Assert.Equal([_openerId, _replyId], [.. reported.Order()]);
    });

    /// <summary>
    /// Only the examiner's replies within the named conversation can be reported.
    /// </summary>
    [Fact]
    public Task Report_refuses_a_turn_that_is_not_this_conversations_reply() => RunTestAsync(async service =>
    {
        // Try to report the student's own turn
        await Assert.ThrowsAsync<DefenseReportTargetException>(() =>
            service.ReportTurnAsync(_ownerId, _sessionId, _studentTurnId, [Category.Tone], comment: null));

        // A turn that doesn't exist at all is refused the same way
        await Assert.ThrowsAsync<DefenseReportTargetException>(() =>
            service.ReportTurnAsync(_ownerId, _sessionId, Guid.NewGuid(), [Category.Tone], comment: null));

        // And so is a reply the student's other conversation holds
        await Assert.ThrowsAsync<DefenseReportTargetException>(() =>
            service.ReportTurnAsync(_ownerId, _sessionId, _otherSessionReplyId, [Category.Tone], comment: null));
    });

    /// <summary>
    /// A report that names no way the reply went wrong holds nothing against it, so there is nothing to record,
    /// and that's the client's fault rather than ours.
    /// </summary>
    [Fact]
    public Task Report_refuses_naming_nothing_wrong() => RunTestAsync(async service =>
    {
        // Report the reply with an empty list of faults
        await Assert.ThrowsAsync<DefenseFeedbackValueException>(() =>
            service.ReportTurnAsync(_ownerId, _sessionId, _replyId, [], comment: null));
    });

    /// <summary>
    /// Blaming something the list doesn't cover says nothing on its own, so the report comes with the student's
    /// own account or not at all. A comment of nothing but whitespace is the same as none.
    /// </summary>
    [Fact]
    public Task Report_refuses_blaming_something_else_without_saying_what() => RunTestAsync(async service =>
    {
        // Blame something off the list, saying nothing about it
        await Assert.ThrowsAsync<DefenseFeedbackValueException>(() =>
            service.ReportTurnAsync(_ownerId, _sessionId, _replyId, [Category.Other], comment: null));

        // Say it in whitespace, which carries no more than saying nothing
        await Assert.ThrowsAsync<DefenseFeedbackValueException>(() =>
            service.ReportTurnAsync(_ownerId, _sessionId, _replyId, [Category.Other], "   "));

        // It rides along with a category that speaks for itself, and is refused all the same
        await Assert.ThrowsAsync<DefenseFeedbackValueException>(() =>
            service.ReportTurnAsync(
                _ownerId, _sessionId, _replyId, [Category.Tone, Category.Other], comment: null));

        // Said properly, it lands
        await service.ReportTurnAsync(
            _ownerId, _sessionId, _replyId, [Category.Other], "she answered in English");

        // The comment it was stored with
        var comment = await QueryValueAsync(context =>
            context.DefenseTurnReports.Select(report => report.Comment).SingleAsync());

        // Which is what the student wrote
        Assert.Equal("she answered in English", comment);
    });

    /// <summary>
    /// A value outside the ones the contract names says nothing we can act on, and the column that would hold it
    /// has no label for it, so it is refused here rather than carried into a write that dies on it.
    /// </summary>
    [Fact]
    public Task Feedback_naming_a_value_the_contract_doesnt_define_is_refused() => RunTestAsync(async service =>
    {
        // Report the reply blaming something no category stands for
        await Assert.ThrowsAsync<DefenseFeedbackValueException>(() =>
            service.ReportTurnAsync(_ownerId, _sessionId, _replyId, [(Category)99], comment: null));

        // Answer for the conversation with an outcome nothing stands for
        await Assert.ThrowsAsync<DefenseFeedbackValueException>(() =>
            service.SubmitFeedbackAsync(_ownerId, _sessionId, (DefenseOutcome)99, comment: null));
    });

    /// <summary>
    /// Landing somewhere the list doesn't name says nothing on its own, so the answer comes with the student's
    /// own account of where or not at all. A comment of nothing but whitespace is the same as none.
    /// </summary>
    [Fact]
    public Task An_answer_landing_off_the_list_without_saying_where_is_refused() => RunTestAsync(async service =>
    {
        // Answer that it went somewhere off the list, saying nothing about where
        await Assert.ThrowsAsync<DefenseFeedbackValueException>(() =>
            service.SubmitFeedbackAsync(_ownerId, _sessionId, DefenseOutcome.SomethingElse, comment: null));

        // Say it in whitespace, which carries no more than saying nothing
        await Assert.ThrowsAsync<DefenseFeedbackValueException>(() =>
            service.SubmitFeedbackAsync(_ownerId, _sessionId, DefenseOutcome.SomethingElse, "   "));

        // Neither attempt left a row behind
        Assert.Empty(await QueryValueAsync(context => context.DefenseSessionFeedbacks.ToListAsync()));

        // Said properly, it lands
        await service.SubmitFeedbackAsync(
            _ownerId, _sessionId, DefenseOutcome.SomethingElse, "she kept repeating herself");

        // The comment it was stored with
        var comment = await QueryValueAsync(context =>
            context.DefenseSessionFeedbacks.Select(feedback => feedback.Comment).SingleAsync());

        // Which is what the student wrote
        Assert.Equal("she kept repeating herself", comment);
    });

    /// <summary>
    /// A comment past the configured cap is a bad request, so it never reaches the write.
    /// </summary>
    [Fact]
    public Task A_comment_past_the_cap_is_refused() => RunTestAsync(async service =>
    {
        // One character more than the 50 the test configures
        var tooLong = new string('x', 51);

        // Report a reply with it
        await Assert.ThrowsAsync<DefenseFeedbackCommentTooLongException>(() =>
            service.ReportTurnAsync(_ownerId, _sessionId, _replyId, [Category.Tone], tooLong));

        // Answer with it
        await Assert.ThrowsAsync<DefenseFeedbackCommentTooLongException>(() =>
            service.SubmitFeedbackAsync(_ownerId, _sessionId, DefenseOutcome.ConfirmedTheSolution, tooLong));
    });

    /// <summary>
    /// A comment sitting exactly on the cap is fine. The cap bounds the text that lands rather than what was typed
    /// around it, so whitespace can't push an acceptable comment over it.
    /// </summary>
    [Fact]
    public Task A_comment_at_the_cap_is_kept() => RunTestAsync(async service =>
    {
        // Exactly the 50 the test configures
        var atTheCap = new string('x', 50);

        // Report a reply with it, padded past the cap by whitespace that carries nothing
        await service.ReportTurnAsync(_ownerId, _sessionId, _replyId, [Category.Tone], $"  {atTheCap}  ");

        // Answer for the conversation with it too
        await service.SubmitFeedbackAsync(_ownerId, _sessionId, DefenseOutcome.ConfirmedTheSolution, atTheCap);

        // Read back what each one was stored with
        await QueryAsync(async context =>
        {
            // The report kept the text and dropped the padding
            Assert.Equal(atTheCap, await context.DefenseTurnReports
                .Select(report => report.Comment)
                .SingleAsync());

            // And the answer kept it as it stood
            Assert.Equal(atTheCap, await context.DefenseSessionFeedbacks
                .Select(feedback => feedback.Comment)
                .SingleAsync());
        });
    });

    /// <summary>
    /// Another user's session is indistinguishable from a missing one, so neither write can reach across owners.
    /// </summary>
    [Fact]
    public Task Another_users_session_is_out_of_reach_for_both_writes() => RunTestAsync(async service =>
    {
        // Report a reply in someone else's conversation
        await Assert.ThrowsAsync<DefenseSessionNotFoundException>(() =>
            service.ReportTurnAsync(_otherId, _sessionId, _replyId, [Category.Tone], comment: null));

        // Answer for someone else's conversation
        await Assert.ThrowsAsync<DefenseSessionNotFoundException>(() =>
            service.SubmitFeedbackAsync(_otherId, _sessionId, DefenseOutcome.ConfirmedTheSolution, comment: null));

        // Neither write left a row behind
        await QueryAsync(async context =>
        {
            // Nothing against any reply
            Assert.Empty(await context.DefenseTurnReports.ToListAsync());

            // And nothing for the conversation
            Assert.Empty(await context.DefenseSessionFeedbacks.ToListAsync());
        });
    });

    /// <summary>
    /// Answering again revises the one answer rather than adding a second, keeping the first stamp so the row still
    /// says when the student first spoke.
    /// </summary>
    [Fact]
    public Task Answering_again_revises_the_one_answer() => RunTestAsync(async service =>
    {
        // Answer once
        await service.SubmitFeedbackAsync(_ownerId, _sessionId, DefenseOutcome.NotEnoughHelp, "no idea what she means");

        // The stamps the first answer was written with
        var first = await QueryValueAsync(context => context.DefenseSessionFeedbacks
            .Select(feedback => new { feedback.CreatedAt, feedback.UpdatedAt })
            .SingleAsync());

        // Change the answer
        await service.SubmitFeedbackAsync(_ownerId, _sessionId, DefenseOutcome.FoundTheMistake, "she was right");

        // Read back what the session now holds
        await QueryAsync(async context =>
        {
            // Still exactly one answer
            var feedback = await context.DefenseSessionFeedbacks.SingleAsync();

            // Carrying the revision
            Assert.Equal(DefenseOutcome.FoundTheMistake, feedback.Outcome);
            Assert.Equal("she was right", feedback.Comment);

            // The first stamp stands
            Assert.Equal(first.CreatedAt, feedback.CreatedAt);

            // And the revision moved the second past it
            Assert.True(feedback.UpdatedAt > first.UpdatedAt);
        });
    });

    /// <summary>
    /// What the student holds against a reply is theirs to take back, and asking again for one already gone
    /// leaves them where they wanted to be rather than failing.
    /// </summary>
    [Fact]
    public Task A_report_can_be_taken_back() => RunTestAsync(async service =>
    {
        // Report the opener
        await service.ReportTurnAsync(_ownerId, _sessionId, _openerId, [Category.Tone], comment: null);

        // Report the reply
        await service.ReportTurnAsync(_ownerId, _sessionId, _replyId, [Category.GaveAway], comment: null);

        // Take back the one against the reply
        await service.WithdrawTurnReportAsync(_ownerId, _sessionId, _replyId);

        // Ask again for the one already gone
        await service.WithdrawTurnReportAsync(_ownerId, _sessionId, _replyId);

        // The replies still carrying something
        var reported = await QueryValueAsync(context => context.DefenseTurnReports
            .Select(report => report.TurnId)
            .ToListAsync());

        // Only the opener's, which was never taken back
        Assert.Equal([_openerId], reported);
    });

    /// <summary>
    /// The answer for a conversation is the student's to take back too, leaving that one asking again and every
    /// other conversation of theirs as it was.
    /// </summary>
    [Fact]
    public Task An_answer_can_be_taken_back() => RunTestAsync(async service =>
    {
        // Answer for the conversation under test
        await service.SubmitFeedbackAsync(_ownerId, _sessionId, DefenseOutcome.WasOff, "she was rude");

        // And for the student's other one
        await service.SubmitFeedbackAsync(
            _ownerId, _otherSessionId, DefenseOutcome.NotEnoughHelp, comment: null);

        // Take back the first
        await service.WithdrawFeedbackAsync(_ownerId, _sessionId);

        // Ask again for the answer already gone
        await service.WithdrawFeedbackAsync(_ownerId, _sessionId);

        // The conversations still carrying an answer
        var answered = await QueryValueAsync(context => context.DefenseSessionFeedbacks
            .Select(feedback => feedback.SessionId)
            .ToListAsync());

        // Only the other one, which nobody took anything back from
        Assert.Equal([_otherSessionId], answered);
    });

    /// <summary>
    /// A withdrawal reaches only into the conversation it names, so a reply belonging to another of the student's
    /// own conversations keeps whatever they hold against it.
    /// </summary>
    [Fact]
    public Task Taking_back_a_report_reaches_only_the_named_conversation() => RunTestAsync(async service =>
    {
        // Hold something against the reply in the student's other conversation
        await service.ReportTurnAsync(
            _ownerId, _otherSessionId, _otherSessionReplyId, [Category.Tone], comment: null);

        // Name that reply while taking back a report in this one
        await service.WithdrawTurnReportAsync(_ownerId, _sessionId, _otherSessionReplyId);

        // The replies still carrying something
        var reported = await QueryValueAsync(context => context.DefenseTurnReports
            .Select(report => report.TurnId)
            .ToListAsync());

        // Which is the one the withdrawal never reached, since it named a conversation that doesn't hold it
        Assert.Equal([_otherSessionReplyId], reported);
    });

    /// <summary>
    /// Neither withdrawal reaches across owners, for the same reason neither write does.
    /// </summary>
    [Fact]
    public Task Another_users_session_is_out_of_reach_for_both_withdrawals() => RunTestAsync(async service =>
    {
        // Hold something against the reply
        await service.ReportTurnAsync(_ownerId, _sessionId, _replyId, [Category.Tone], comment: null);

        // Answer for the conversation
        await service.SubmitFeedbackAsync(_ownerId, _sessionId, DefenseOutcome.WasOff, comment: null);

        // Take back a report in someone else's conversation
        await Assert.ThrowsAsync<DefenseSessionNotFoundException>(() =>
            service.WithdrawTurnReportAsync(_otherId, _sessionId, _replyId));

        // Take back the answer for someone else's conversation
        await Assert.ThrowsAsync<DefenseSessionNotFoundException>(() =>
            service.WithdrawFeedbackAsync(_otherId, _sessionId));

        // Neither reached anything
        await QueryAsync(async context =>
        {
            // What is held against the reply still stands
            Assert.Single(await context.DefenseTurnReports.ToListAsync());

            // And so does the answer for the conversation
            Assert.Single(await context.DefenseSessionFeedbacks.ToListAsync());
        });
    });

    /// <summary>
    /// A revision replaces both halves of the answer, so words written before can be dropped for the outcome alone.
    /// </summary>
    [Fact]
    public Task An_answer_may_be_revised_down_to_the_outcome_alone() => RunTestAsync(async service =>
    {
        // Answer with both halves
        await service.SubmitFeedbackAsync(_ownerId, _sessionId, DefenseOutcome.FoundTheMistake, "she was right");

        // Answer again with nothing written
        await service.SubmitFeedbackAsync(_ownerId, _sessionId, DefenseOutcome.NotEnoughHelp, comment: null);

        // Read back what the session now holds
        await QueryAsync(async context =>
        {
            // Still exactly one answer
            var feedback = await context.DefenseSessionFeedbacks.SingleAsync();

            // Carrying the revised outcome
            Assert.Equal(DefenseOutcome.NotEnoughHelp, feedback.Outcome);

            // And the words went with the revision rather than standing on what was written before
            Assert.Null(feedback.Comment);
        });
    });

    /// <summary>
    /// A report is only worth anything beside the reply it is against, so a rewind past that reply takes it. The
    /// answer for the conversation is a different thing and stands: it is about the whole exchange, and revising
    /// it is the student's own call. The turn delete here is the one a rewind issues.
    /// </summary>
    [Fact]
    public Task Rewinding_past_a_reported_reply_takes_the_report_with_it() => RunTestAsync(async service =>
    {
        // Report the reply
        await service.ReportTurnAsync(_ownerId, _sessionId, _replyId, [Category.GaveAway], "that was the whole idea");

        // Answer for the conversation as a whole
        await service.SubmitFeedbackAsync(_ownerId, _sessionId, DefenseOutcome.ConfirmedTheSolution, comment: null);

        // Rewind past the reported reply, dropping it
        await RewindPastTheReplyAsync();

        // What each one is against decides whether it survived
        await QueryAsync(async context =>
        {
            // The reply is gone, and so is what was held against it
            Assert.Empty(await context.DefenseTurnReports.ToListAsync());

            // The answer for the conversation stands
            Assert.NotNull(await context.DefenseSessionFeedbacks.SingleOrDefaultAsync());
        });
    });

    /// <summary>
    /// A rewind reaches only the replies it drops, so what the student holds against one that survives the cut
    /// survives with it.
    /// </summary>
    [Fact]
    public Task Rewinding_keeps_the_reports_on_the_replies_it_keeps() => RunTestAsync(async service =>
    {
        // Report the opener, which sits before the cut
        await service.ReportTurnAsync(_ownerId, _sessionId, _openerId, [Category.Tone], comment: null);

        // Report the reply, which the cut drops
        await service.ReportTurnAsync(_ownerId, _sessionId, _replyId, [Category.GaveAway], comment: null);

        // Rewind past the reply
        await RewindPastTheReplyAsync();

        // The reply each surviving report names
        var reported = await QueryValueAsync(context => context.DefenseTurnReports
            .Select(report => report.TurnId)
            .ToListAsync());

        // Only what was held against the surviving opener is left
        Assert.Equal([_openerId], reported);
    });

    /// <summary>
    /// Deleting a session takes everything the student said about it: deletion is the privacy act. A report goes
    /// two ways from here — its own foreign key to the session, and the reply it hangs off going with the
    /// session's turns — so this stays asserted rather than assumed.
    /// </summary>
    [Fact]
    public Task Deleting_the_session_takes_its_feedback_with_it() => RunTestAsync(async service =>
    {
        // Report one of the replies
        await service.ReportTurnAsync(_ownerId, _sessionId, _replyId, [Category.Misunderstood], "the bound is wrong");

        // Answer for the conversation as a whole
        await service.SubmitFeedbackAsync(_ownerId, _sessionId, DefenseOutcome.WasOff, comment: null);

        // Drop the session
        await QueryAsync(async context =>
        {
            // The one row the cascades all hang off
            await context.DefenseSessions.Where(session => session.Id == _sessionId).ExecuteDeleteAsync();
        });

        // Nothing the student said about it survives
        await QueryAsync(async context =>
        {
            // No report against any of its replies
            Assert.Empty(await context.DefenseTurnReports.ToListAsync());

            // And no answer for the conversation as a whole
            Assert.Empty(await context.DefenseSessionFeedbacks.ToListAsync());
        });
    });

    /// <summary>
    /// The table requires a report to name something, so a bug that walks past the service can't leave an empty
    /// one behind.
    /// </summary>
    [Fact]
    public Task The_database_refuses_a_report_holding_nothing() => RunTestAsync(async _ =>
    {
        // Write one straight to the table, going around the service that would have refused it
        var write = QueryAsync(async context =>
        {
            // A report naming nothing at all
            context.DefenseTurnReports.Add(NewReport([], comment: "something happened"));

            // Push it at the table
            await context.SaveChangesAsync();
        });

        // The table refuses it
        await Assert.ThrowsAsync<DbUpdateException>(() => write);
    });

    /// <summary>
    /// The table also requires a report blaming something off the list to carry an account of it, and holds an
    /// account of nothing but whitespace to be no account at all. This is the condition that has to reach inside
    /// the categories array, so it is the one most easily written wrong.
    /// </summary>
    [Fact]
    public Task The_database_refuses_blaming_something_else_in_silence() => RunTestAsync(async _ =>
    {
        // Write one straight to the table, going around the service that would have refused it
        var write = QueryAsync(async context =>
        {
            // A report blaming something off the list without a word about it
            context.DefenseTurnReports.Add(NewReport([Category.Tone, Category.Other], comment: null));

            // Push it at the table
            await context.SaveChangesAsync();
        });

        // The table refuses it
        await Assert.ThrowsAsync<DbUpdateException>(() => write);

        // The same thing said in whitespace, which the service would have reduced to nothing
        var blankWrite = QueryAsync(async context =>
        {
            // A report blaming something off the list, with a comment carrying no text
            context.DefenseTurnReports.Add(NewReport([Category.Tone, Category.Other], " \t\n "));

            // Push it at the table
            await context.SaveChangesAsync();
        });

        // Which the table refuses just the same
        await Assert.ThrowsAsync<DbUpdateException>(() => blankWrite);

        // The same categories, said properly, land
        await QueryAsync(async context =>
        {
            // The report as the service would have written it
            context.DefenseTurnReports.Add(
                NewReport([Category.Tone, Category.Other], "she answered in English"));

            // Push it at the table
            await context.SaveChangesAsync();
        });
    });

    /// <summary>
    /// A report is held to a reply of the very conversation it is filed under, so the table refuses one naming a
    /// reply another conversation holds however the row was assembled.
    /// </summary>
    [Fact]
    public Task The_database_refuses_a_report_naming_another_conversations_reply() => RunTestAsync(async _ =>
    {
        // Write one straight to the table, going around the service that would have refused it
        var write = QueryAsync(async context =>
        {
            // A report filed under one conversation against a reply the other one holds
            context.DefenseTurnReports.Add(new DefenseTurnReport
            {
                SessionId = _sessionId,
                TurnId = _otherSessionReplyId,
                Categories = [Category.Tone],
                Comment = null,
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow,
            });

            // Push it at the table
            await context.SaveChangesAsync();
        });

        // The table refuses it
        await Assert.ThrowsAsync<DbUpdateException>(() => write);
    });

    /// <summary>
    /// The table also requires an answer landing off the list to say where it landed instead, and holds words of
    /// nothing but whitespace to be no account at all.
    /// </summary>
    [Fact]
    public Task The_database_refuses_an_answer_landing_off_the_list_in_silence() => RunTestAsync(async _ =>
    {
        // Write one straight to the table, going around the service that would have refused it
        var write = QueryAsync(async context =>
        {
            // An answer landing off the list without a word about where
            context.DefenseSessionFeedbacks.Add(NewFeedback(DefenseOutcome.SomethingElse, comment: null));

            // Push it at the table
            await context.SaveChangesAsync();
        });

        // The table refuses it
        await Assert.ThrowsAsync<DbUpdateException>(() => write);

        // The same answer with words carrying no text, which the service would have reduced to nothing
        var blankWrite = QueryAsync(async context =>
        {
            // An answer landing off the list whose only account is whitespace
            context.DefenseSessionFeedbacks.Add(NewFeedback(DefenseOutcome.SomethingElse, " \t\n "));

            // Push it at the table
            await context.SaveChangesAsync();
        });

        // Which the table refuses just the same
        await Assert.ThrowsAsync<DbUpdateException>(() => blankWrite);

        // An outcome that speaks for itself needs no account, so a silent one lands
        await QueryAsync(async context =>
        {
            // The answer as the service would have written it
            context.DefenseSessionFeedbacks.Add(NewFeedback(DefenseOutcome.WasOff, comment: null));

            // Push it at the table
            await context.SaveChangesAsync();
        });
    });

    /// <summary>
    /// Builds an answer for the seeded conversation, for writing straight to the table.
    /// </summary>
    /// <param name="outcome">Where the conversation left the student.</param>
    /// <param name="comment">Their own words about it, or null when they wrote none.</param>
    /// <returns>The answer, ready to add.</returns>
    private static DefenseSessionFeedback NewFeedback(DefenseOutcome outcome, string? comment) => new()
    {
        SessionId = _sessionId,
        Outcome = outcome,
        Comment = comment,
        CreatedAt = DateTimeOffset.UtcNow,
        UpdatedAt = DateTimeOffset.UtcNow,
    };

    /// <summary>
    /// Builds a report against the seeded reply, for writing straight to the table.
    /// </summary>
    /// <param name="categories">Every way the reply went wrong.</param>
    /// <param name="comment">The student's own account of it, or null when they gave none.</param>
    /// <returns>The report, ready to add.</returns>
    private static DefenseTurnReport NewReport(List<Category> categories, string? comment) => new()
    {
        SessionId = _sessionId,
        TurnId = _replyId,
        Categories = categories,
        Comment = comment,
        CreatedAt = DateTimeOffset.UtcNow,
        UpdatedAt = DateTimeOffset.UtcNow,
    };

    /// <summary>
    /// Truncates the conversation under test past its examiner reply, the way a rewind does.
    /// </summary>
    private Task RewindPastTheReplyAsync() => QueryAsync(async context =>
    {
        // Drop the reply and everything after it
        await context.DefenseTurns
            .Where(turn => turn.SessionId == _sessionId && turn.Sequence >= ReplySequence)
            .ExecuteDeleteAsync();
    });

    /// <summary>
    /// Builds one seeded conversation of the owner's.
    /// </summary>
    /// <param name="sessionId">The conversation's identifier.</param>
    /// <returns>The session, ready to add.</returns>
    private static DefenseSession NewSession(Guid sessionId) => new()
    {
        Id = sessionId,
        UserId = _ownerId,
        ProblemStatement = "a problem",
        ProblemReference = "a reference",
        ExaminerConfig = "{}",
        CreatedAt = DateTimeOffset.UtcNow,
    };

    /// <summary>
    /// Builds one seeded turn.
    /// </summary>
    /// <param name="turnId">The turn's identifier.</param>
    /// <param name="sessionId">The conversation the turn belongs to.</param>
    /// <param name="role">Who authored the turn.</param>
    /// <param name="content">The turn's text.</param>
    /// <param name="sequence">The turn's position in the conversation.</param>
    /// <returns>The turn, ready to add.</returns>
    private static DefenseTurn NewTurn(
        Guid turnId, Guid sessionId, TranscriptRole role, string content, int sequence) => new()
        {
            Id = turnId,
            SessionId = sessionId,
            Role = role,
            Content = content,
            Sequence = sequence,
            CreatedAt = DateTimeOffset.UtcNow,
        };
}

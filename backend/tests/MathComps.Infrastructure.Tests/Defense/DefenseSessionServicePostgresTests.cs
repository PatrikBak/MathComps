using MathComps.Domain.Contracts.Defense;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Options;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Ai;
using MathComps.Domain.Localization;
using MathComps.Infrastructure.Services.Defense;
using MathComps.Infrastructure.Services.Defense.Content;
using MathComps.Infrastructure.Services.Defense.Dtos;
using MathComps.Infrastructure.Services.Defense.Engine;
using MathComps.Infrastructure.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace MathComps.Infrastructure.Tests.Defense;

/// <summary>
/// Integration tests for <see cref="DefenseSessionService"/> against a real PostgreSQL database, with a fake examiner
/// (no live LLM): the conversation flow (start, continue, list, delete), that what the student has said about a
/// conversation comes back with it, that each turn writes an independent spend row that outlives the session, that a
/// turn records every draft it went through and drops them when the turn is rewound past, ownership isolation, the
/// guardrails (message length, turn cap, per-user spend ceiling), and that a turn the client cancels still records the
/// cost its calls billed so aborting can't dodge the ceiling.
/// </summary>
/// <param name="fixture">The shared PostgreSQL container fixture.</param>
public class DefenseSessionServicePostgresTests(PostgresContainerFixture fixture)
    : PostgresTestBase<IDefenseSessionService>(fixture), IDisposable
{
    /// <summary>
    /// The user who owns the sessions under test.
    /// </summary>
    private static readonly Guid _ownerId = Guid.Parse("00000000-0000-0000-0000-000000000001");

    /// <summary>
    /// A second user, for the ownership-isolation checks.
    /// </summary>
    private static readonly Guid _otherId = Guid.Parse("00000000-0000-0000-0000-000000000002");

    /// <summary>
    /// The fake examiner's fixed per-turn cost.
    /// </summary>
    private const decimal TurnCost = 0.02m;

    /// <summary>
    /// What each cancelled turn costs before it throws.
    /// </summary>
    private const decimal CancelCost = 0.40m;

    /// <summary>
    /// What one call of a drafted turn bills, small enough that a whole run of drafts stays under the ceiling.
    /// </summary>
    private const decimal DraftCallCost = 0.01m;

    /// <summary>
    /// The note the leak on a drafted turn's first attempt sends back to the generator.
    /// </summary>
    private const string DraftRevisionNote = "REVISION REQUIRED — you gave away the counterexample.";

    /// <summary>
    /// The note a drafted turn's fallback runs under, once the leak has outlasted the revision cap.
    /// </summary>
    private const string DraftHoldNote = "REVISION REQUIRED — write a minimal holding reply instead.";

    /// <summary>
    /// How long the one call of a drafted attempt takes.
    /// </summary>
    private const int DraftCallDurationMs = 1_200;

    /// <summary>
    /// How long each of a drafted turn's three attempts takes, in the order they're made. Distinct per attempt, so a
    /// mapping that wrote one attempt's time onto all of them would show.
    /// </summary>
    private static readonly int[] _draftDurationsMs = [2_100, 1_900, 800];

    /// <summary>
    /// The one call each drafted attempt makes, standing in for a real turn's per-step breakdown.
    /// </summary>
    private static readonly ExaminerStepCall _draftCall = new(
        ExaminerStep.Generate,
        "fake/model",
        ReasoningEffort: null,
        new ModelUsage(DraftCallCost, PromptTokens: 10, CompletionTokens: 2, ReasoningTokens: 0,
            CachedPromptTokens: 0),
        DraftCallDurationMs);

    /// <summary>
    /// The usage — cost and tokens — each cancelled turn runs up before it throws.
    /// </summary>
    private static readonly ModelUsage _cancelUsage = new(
        CancelCost, PromptTokens: 80, CompletionTokens: 10, ReasoningTokens: 0, CachedPromptTokens: 0);

    /// <summary>
    /// The examiner the service runs against: a scripted no-cost fake by default, or one a cancellation test swaps in
    /// to run up cost and then throw mid-turn. Read by <see cref="ConfigureServices"/>, so a test sets it before the
    /// run.
    /// </summary>
    private IExaminer _examiner = new FakeExaminer(
        new ModelUsage(TurnCost, PromptTokens: 150, CompletionTokens: 25, ReasoningTokens: 0, CachedPromptTokens: 0));

    /// <summary>
    /// The source a cancellation test cancels mid-turn (through the examiner) to stand in for the client aborting; its
    /// token is the one passed to the call, so the service sees a genuine cancellation of its own token.
    /// </summary>
    private CancellationTokenSource? _abort;

    /// <summary>
    /// The handout content every start resolves against. Read by <see cref="ConfigureServices"/>, so a test
    /// swapping it must do so before the service is built.
    /// </summary>
    private readonly FakeDefenseContentResolver _content = new();

    /// <inheritdoc/>
    protected override void ConfigureServices(IServiceCollection services)
    {
        // The examiner the service runs against — a fake, so no LLM is called and the turn's spend is deterministic.
        services.AddScoped(_ => _examiner);

        // Tight caps so the guardrails are cheap to trip.
        services.Configure<DefenseLimits>(limits =>
        {
            limits.MaxCandidateChars = 100;
            limits.MaxHandoutContentIdChars = 30;
            limits.MaxEnvironmentIdChars = 200;
            limits.MaxFeedbackCommentChars = 50;
            limits.MaxTurnsPerSession = 2;
            limits.DailySpendCeilingPerUser = 1.00m;
        });

        // A minimal examiner config so the session's snapshot is a real settings object, not null members. The
        // prompt paths point at the real templates, since the snapshot provider below actually reads them.
        services.Configure<ExaminerSettings>(examiner =>
        {
            examiner.Generate = new ChatStepSettings { Prompt = "Prompts/generate.txt", Model = "fake/model" };
            examiner.MathCheck = new ChatStepSettings { Prompt = "Prompts/math-check.txt", Model = "fake/model" };
            examiner.LeakCheck = new ChatStepSettings { Prompt = "Prompts/leak-check.txt", Model = "fake/model" };
            examiner.LanguageCheck =
                new ChatStepSettings { Prompt = "Prompts/language-check.txt", Model = "fake/model" };
            examiner.MaxRevisions = 3;
        });

        // Builds the session snapshot from the config above; this test bypasses AddExaminer, so it's registered
        // directly.
        services.AddSingleton<IExaminerConfigSnapshotProvider, ExaminerConfigSnapshotProvider>();

        // Stands in for the published handout content the examiner is served from.
        services.AddSingleton<IDefenseContentResolver>(_ => _content);

        // The examiner's own lines, read from the real resource so a missing translation shows up here.
        services.AddSingleton<IDefenseCopy, DefenseCopy>();

        // Serializes a user's concurrent turns.
        services.AddSingleton<IDefenseUserTurnGate, DefenseUserTurnGate>();

        // The service under test.
        services.AddScoped<IDefenseSessionService, DefenseSessionService>();
    }

    /// <inheritdoc/>
    protected override async Task SeedDataAsync(MathCompsDbContext context)
    {
        // Two users, so ownership isolation can be checked.
        context.Users.AddRange(
            new User { Id = _ownerId, ExternalId = "ext-owner", Username = "Owner" },
            new User { Id = _otherId, ExternalId = "ext-other", Username = "Other" });

        // Commit the seed.
        await context.SaveChangesAsync();
    }

    /// <inheritdoc/>
    public void Dispose()
    {
        // Drop the last cancellation source a cancel test left behind.
        _abort?.Dispose();

        // Standard IDisposable: no finalizer needs to run now that cleanup is done.
        GC.SuppressFinalize(this);
    }

    /// <summary>
    /// Starting a session seeds the opener and the student turn, appends the examiner's reply, and writes one spend
    /// row for the turn.
    /// </summary>
    [Fact]
    public Task Start_creates_the_three_turns_and_a_spend_row() => RunTestAsync(async service =>
    {
        // Open a session with the student's first message
        var session = await service.StartAsync(_ownerId, Request("prob-1", "my defense"));

        // The conversation is opener, student, examiner — in that order
        Assert.Equal(
            [TranscriptRole.Examiner, TranscriptRole.Candidate, TranscriptRole.Examiner],
            session.Turns.Select(turn => turn.Role));

        // The opener is the examiner's own line rather than anything the caller sent, the student turn is what
        // they wrote, and the examiner had something to say
        Assert.StartsWith("Hi, I'm Mathilda", session.Turns[0].Content, StringComparison.Ordinal);
        Assert.Equal("my defense", session.Turns[1].Content);
        Assert.NotEmpty(session.Turns[2].Content);

        // The turn wrote exactly one spend row carrying the fake examiner's cost and tokens
        await QueryAsync(async context =>
        {
            // The user's spend rows
            var spends = await context.DefenseSpends.Where(spend => spend.UserId == _ownerId).ToListAsync();

            // One row, carrying the turn's cost and tokens
            var spend = Assert.Single(spends);
            Assert.Equal(TurnCost, spend.Cost);
            Assert.Equal(150, spend.PromptTokens);
            Assert.Equal(25, spend.CompletionTokens);
        });
    });

    /// <summary>
    /// Continuing a session appends the student turn and the examiner's reply, and writes a second spend row.
    /// </summary>
    [Fact]
    public Task Continue_appends_two_turns_and_a_second_spend_row() => RunTestAsync(async service =>
    {
        // Open a session
        var started = await service.StartAsync(_ownerId, Request("prob-1", "my defense"));

        // Continue it with a second student message
        var continued = await service.ContinueAsync(_ownerId, started.Id, "my next point");

        // The two new turns are appended after the opening three
        Assert.Equal(
            [
                TranscriptRole.Examiner, TranscriptRole.Candidate, TranscriptRole.Examiner,
                TranscriptRole.Candidate, TranscriptRole.Examiner,
            ],
            continued.Turns.Select(turn => turn.Role));

        // The new student turn holds what was sent
        Assert.Equal("my next point", continued.Turns[3].Content);

        // Continue rebuilds the target from the stored rows rather than echoing a caller's copy, and its two
        // halves are same-typed strings, so nothing but this pins them the right way round
        Assert.Equal(new HandoutEnvironmentTarget("handout-1", "prob-1"), continued.Target);

        // Count the user's spend rows
        var spendCount = await QueryValueAsync(context =>
            context.DefenseSpends.CountAsync(spend => spend.UserId == _ownerId));

        // One row per turn — two in all
        Assert.Equal(2, spendCount);
    });

    /// <summary>
    /// A continued conversation still carries what the student has already said about it. Both the answer and the
    /// reports are absent-by-default on the entity, so a load that skips either hands back a conversation claiming
    /// nothing was ever said about it, with nothing thrown to give it away.
    /// </summary>
    [Fact]
    public Task Continue_carries_what_was_already_said_about_the_conversation() => RunTestAsync(async service =>
    {
        // Open a session
        var started = await service.StartAsync(_ownerId, Request("prob-1", "my defense"));

        // The examiner's reply
        var replyId = started.Turns[^1].Id;

        // Everything the student has already said about the conversation
        await QueryAsync(async context =>
        {
            // What they hold against that reply
            context.DefenseTurnReports.Add(
                NewReport(started.Id, replyId, DefenseReportCategory.SaidSomethingWrong, "which case?"));

            // And their answer for the conversation as a whole
            context.DefenseSessionFeedbacks.Add(NewFeedback(started.Id, DefenseOutcome.NotEnoughHelp));

            // Commit the seed
            await context.SaveChangesAsync();
        });

        // Take the conversation one turn further
        var continued = await service.ContinueAsync(_ownerId, started.Id, "my next point");

        // The answer for the conversation comes back with it
        Assert.Equal(DefenseOutcome.NotEnoughHelp, continued.Feedback?.Outcome);

        // And so does what is held against the earlier reply
        var report = Assert.Single(continued.Reports);
        Assert.Equal(replyId, report.TurnId);
    });

    /// <summary>
    /// A problem's sessions come back ordered by when they were last spoken in and not by when they were started,
    /// so the leading one is the conversation the student was last in.
    /// </summary>
    [Fact]
    public Task List_puts_the_session_spoken_in_most_recently_first() => RunTestAsync(async service =>
    {
        // Two sessions against the same problem
        var older = await service.StartAsync(_ownerId, Request("prob-1", "older"));
        var newer = await service.StartAsync(_ownerId, Request("prob-1", "newer"));

        // Take the one started first further
        await service.ContinueAsync(_ownerId, older.Id, "back to this one");

        // List the problem's sessions
        var sessions = (await service.ListAsync(
            _ownerId, new HandoutEnvironmentTarget("handout-1", "prob-1"))).Sessions;

        // The continued one leads, ahead of the one started after it
        Assert.Equal([older.Id, newer.Id], sessions.Select(session => session.Id));
    });

    /// <summary>
    /// Listing returns only the user's sessions for the given problem.
    /// </summary>
    [Fact]
    public Task List_filters_by_user_and_problem() => RunTestAsync(async service =>
    {
        // Two problems for the owner, and one for the other user
        var first = await service.StartAsync(_ownerId, Request("prob-1", "first"));
        await service.StartAsync(_ownerId, Request("prob-2", "other problem"));
        await service.StartAsync(_otherId, Request("prob-1", "someone else"));

        // List the owner's sessions for problem 1
        var sessions = (await service.ListAsync(
            _ownerId, new HandoutEnvironmentTarget("handout-1", "prob-1"))).Sessions;

        // Only the owner's single prob-1 session comes back
        var listed = Assert.Single(sessions);
        Assert.Equal(first.Id, listed.Id);
    });

    /// <summary>
    /// A listed session carries the whole conversation as the client reads it: every turn in order under its own
    /// id, the answer for the conversation, and what the student holds against a reply, every enum among them
    /// round-tripping through its own database type. This read builds its own projection rather than sharing
    /// the mapper the start and continue paths use, so nothing but this pins what it assembles.
    /// </summary>
    [Fact]
    public Task List_returns_the_conversation_in_the_shape_the_client_reads() => RunTestAsync(async service =>
    {
        // A conversation: the opener, the student, and the reply
        var started = await service.StartAsync(_ownerId, Request("prob-1", "my defense"));

        // The examiner's reply
        var replyId = started.Turns[^1].Id;

        // Everything the student has said about the conversation
        await QueryAsync(async context =>
        {
            // One report naming every fault there is, so every category is read back
            context.DefenseTurnReports.Add(new DefenseTurnReport
            {
                SessionId = started.Id,
                TurnId = replyId,
                Categories = [.. Enum.GetValues<DefenseReportCategory>()],
                Comment = "she just told me",
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow,
            });

            // And their answer for the conversation as a whole
            context.DefenseSessionFeedbacks.Add(NewFeedback(started.Id, DefenseOutcome.FoundTheMistake));

            // Commit the seed
            await context.SaveChangesAsync();
        });

        // Re-read the conversation
        var listed = Assert.Single(
            (await service.ListAsync(_ownerId, new HandoutEnvironmentTarget("handout-1", "prob-1"))).Sessions);

        // Its turns come back in order, each under its author
        Assert.Equal(
            [TranscriptRole.Examiner, TranscriptRole.Candidate, TranscriptRole.Examiner],
            listed.Turns.Select(turn => turn.Role));

        // Each turn carries its own words
        Assert.Equal("my defense", listed.Turns[1].Content);

        // And its own identity, which is what a report is held against
        Assert.Equal(replyId, listed.Turns[^1].Id);

        // What the student made of the conversation as a whole
        Assert.Equal(DefenseOutcome.FoundTheMistake, listed.Feedback?.Outcome);

        // And every way the reply went wrong, in the order the report holds them
        var report = Assert.Single(listed.Reports);
        Assert.Equal(Enum.GetValues<DefenseReportCategory>(), report.Categories);

        // Along with what the student said in their own words
        Assert.Equal("she just told me", report.Comment);
    });

    /// <summary>
    /// An environment id is unique only within its handout, not site-wide, so listing must scope by both: the same
    /// id string in a different handout is a different environment entirely.
    /// </summary>
    [Fact]
    public Task List_scopes_by_handout_not_just_environment_id() => RunTestAsync(async service =>
    {
        // The same environment id, "prob-1", in two different handouts
        var inFirstHandout = await service.StartAsync(_ownerId, Request("prob-1", "first handout"));
        await service.StartAsync(_ownerId, Request("prob-1", "second handout", "handout-2"));

        // List against handout-1's prob-1
        var sessions = (await service.ListAsync(
            _ownerId, new HandoutEnvironmentTarget("handout-1", "prob-1"))).Sessions;

        // Only that handout's session comes back
        var listed = Assert.Single(sessions);
        Assert.Equal(inFirstHandout.Id, listed.Id);

        // And it names the environment the right way round. The two halves are same-typed strings, so a swapped
        // projection would otherwise sail past every filter assertion above.
        Assert.Equal(new HandoutEnvironmentTarget("handout-1", "prob-1"), listed.Target);
    });

    /// <summary>
    /// The caps a defense is held to come back with the list, since they are configuration the server can be
    /// given a new value for at any time.
    /// </summary>
    [Fact]
    public Task List_reports_the_caps_a_client_is_held_to() => RunTestAsync(async service =>
    {
        // Read a problem nothing has been defended against yet, since the caps stand whatever the history holds
        var listing = await service.ListAsync(_ownerId, new HandoutEnvironmentTarget("handout-1", "prob-1"));

        // Every cap comes back as configured. All three are ints, so the values are kept distinct: a projection
        // handing them over in the wrong order would otherwise sail past.
        Assert.Equal(100, listing.Limits.MaxCandidateChars);
        Assert.Equal(50, listing.Limits.MaxFeedbackCommentChars);
        Assert.Equal(2, listing.Limits.MaxTurnsPerSession);
    });

    /// <summary>
    /// Listing all of a user's sessions returns every problem's sessions ordered by when they were last spoken in
    /// rather than when they were started, each carrying its statement and the student's most recent message, and
    /// excludes other users' sessions.
    /// </summary>
    [Fact]
    public Task ListAll_returns_every_problem_last_spoken_in_first_with_statement_and_preview() =>
        RunTestAsync(async service =>
    {
        // Three sessions for the owner across two problems, and one for another user
        var first = await service.StartAsync(_ownerId, Request("prob-1", "first"));
        var second = await service.StartAsync(_ownerId, Request("prob-2", "second"));
        var third = await service.StartAsync(_ownerId, Request("prob-1", "third"));
        await service.StartAsync(_otherId, Request("prob-1", "someone else"));

        // Take the oldest one further, so activity order and creation order disagree
        await service.ContinueAsync(_ownerId, first.Id, "one more thing");

        // List every session the owner holds
        var sessions = await service.ListAllAsync(_ownerId);

        // Only the owner's three come back, across both problems, most recently active first
        Assert.Equal([first.Id, third.Id, second.Id], sessions.Select(session => session.Id));

        // The one that was just continued
        var continued = sessions[0];

        // It carries its target, snapshotted statement, and the student's most recent message
        Assert.Equal(new HandoutEnvironmentTarget("handout-1", "prob-1"), continued.Target);
        Assert.Equal(FakeDefenseContentResolver.Statement, continued.Statement);
        Assert.Equal("one more thing", continued.LastStudentMessage);

        // And its stamp came from that appended turn, later than every other session's
        Assert.True(continued.LastActivityAt > sessions[1].LastActivityAt);
    });

    /// <summary>
    /// A session rewound to the examiner's opener has no student message left, which the listing reports as none.
    /// </summary>
    [Fact]
    public Task ListAll_reports_no_student_message_when_the_student_has_none() =>
        RunTestAsync(async service =>
    {
        // A session the student has spoken in
        var session = await service.StartAsync(_ownerId, Request("prob-1", "my defense"));

        // Rewind it to the opener, dropping the student's only message
        await service.RewindAsync(_ownerId, session.Id, keepThroughSequence: 0);

        // List every session the owner holds
        var sessions = await service.ListAllAsync(_ownerId);

        // The session is still there, with nothing the student said to preview
        var listed = Assert.Single(sessions);
        Assert.Null(listed.LastStudentMessage);
    });

    /// <summary>
    /// A turn records every draft the examiner made and every call each one billed, so a reviewer can read what the
    /// guards sent back and what each step cost. A turn that ran out of revisions marks its fallback, and marks only
    /// that one: the flag describes the draft it replaced the flagged one with, not the run it came out of.
    /// Rewinding past the turn takes the drafts with it, which is the composite key's whole job — they hang off the
    /// turn rather than off the session.
    /// </summary>
    [Fact]
    public Task Continue_records_every_draft_and_its_calls()
    {
        // An examiner that leaks its way through the cap and retreats to the fallback.
        _examiner = new DraftingExaminer();

        // Run the turn and read back what it recorded.
        return RunTestAsync(async service =>
    {
        // A session whose reply took three drafts
        var session = await service.StartAsync(_ownerId, Request("prob-1", "my defense"));

        // The drafts landed against the examiner's reply, in the order they were made
        await QueryAsync(async context =>
        {
            // Everything recorded for this session, calls included
            var attempts = await context.DefenseTurnAttempts
                .Include(attempt => attempt.Calls)
                .Where(attempt => attempt.SessionId == session.Id)
                .OrderBy(attempt => attempt.AttemptIndex)
                .ToListAsync();

            // Every draft is there, the first rejection at the front
            Assert.Equal(3, attempts.Count);
            Assert.Equal("a leaky draft.", attempts[0].Reply);
            Assert.True(attempts[0].Leaks);
            Assert.Equal("the counterexample", attempts[0].WhatLeaked);

            // The second ran under the note the leak produced, and leaked all the same
            Assert.Equal(DraftRevisionNote, attempts[1].RevisionNote);
            Assert.True(attempts[1].Leaks);

            // Which left the last as the fallback, and it alone
            Assert.Equal([false, false, true], attempts.Select(attempt => attempt.IsSafeFallback));
            Assert.Equal(DraftHoldNote, attempts[2].RevisionNote);

            // Each draft carries the calls it made, attributed per step
            var call = Assert.Single(attempts[2].Calls);
            Assert.Equal(ExaminerStep.Generate, call.Step);
            Assert.Equal(DraftCallCost, call.Cost);

            // And how long it all took, per draft and per call, which is what a slow turn is traced through
            Assert.Equal(_draftDurationsMs, attempts.Select(attempt => attempt.DurationMs));
            Assert.Equal(DraftCallDurationMs, call.DurationMs);
        });

        // Rewind past the examiner's reply, dropping the turn the drafts hang off
        await service.RewindAsync(_ownerId, session.Id, keepThroughSequence: 0);

        // The drafts went with it, rather than outliving the reply they were made for
        await QueryAsync(async context =>
            Assert.Equal(0, await context.DefenseTurnAttempts.CountAsync()));
    });
    }

    /// <summary>
    /// Deleting a session removes it and its turns, but the independent spend rows remain.
    /// </summary>
    [Fact]
    public Task Delete_removes_the_session_but_keeps_the_spend() => RunTestAsync(async service =>
    {
        // Open a session
        var session = await service.StartAsync(_ownerId, Request("prob-1", "my defense"));

        // Delete it
        await service.DeleteAsync(_ownerId, session.Id);

        // The session and its turns are gone, but the spend record survives
        await QueryAsync(async context =>
        {
            // No sessions or turns remain
            Assert.Equal(0, await context.DefenseSessions.CountAsync());
            Assert.Equal(0, await context.DefenseTurns.CountAsync());

            // The spend row is untouched
            Assert.Equal(1, await context.DefenseSpends.CountAsync(spend => spend.UserId == _ownerId));
        });
    });

    /// <summary>
    /// A session belonging to another user is treated as absent on both continue and delete.
    /// </summary>
    [Fact]
    public Task Another_users_session_is_not_found() => RunTestAsync(async service =>
    {
        // The owner opens a session
        var session = await service.StartAsync(_ownerId, Request("prob-1", "my defense"));

        // The other user can neither continue, rewind, nor delete it
        await Assert.ThrowsAsync<DefenseSessionNotFoundException>(
            () => service.ContinueAsync(_otherId, session.Id, "sneaking in"));
        await Assert.ThrowsAsync<DefenseSessionNotFoundException>(
            () => service.RewindAsync(_otherId, session.Id, 0));
        await Assert.ThrowsAsync<DefenseSessionNotFoundException>(
            () => service.DeleteAsync(_otherId, session.Id));
    });

    /// <summary>
    /// An id matching no session at all reads as absent on continue, rewind, and delete — a different branch from
    /// the wrong-owner case, since delete distinguishes the two only by how many rows its statement removed.
    /// </summary>
    [Fact]
    public Task A_session_that_never_existed_is_not_found() => RunTestAsync(async service =>
    {
        // An id no session was ever minted under
        var missingId = Guid.CreateVersion7();

        // Every operation that names a session treats it as absent
        await Assert.ThrowsAsync<DefenseSessionNotFoundException>(
            () => service.ContinueAsync(_ownerId, missingId, "into the void"));
        await Assert.ThrowsAsync<DefenseSessionNotFoundException>(
            () => service.RewindAsync(_ownerId, missingId, 0));
        await Assert.ThrowsAsync<DefenseSessionNotFoundException>(
            () => service.DeleteAsync(_ownerId, missingId));
    });

    /// <summary>
    /// Anchor rows are minted once and reused. Defending the same environment twice must not mint a second row for
    /// it, and a second environment must hang off the handout row already there rather than a duplicate of it.
    /// </summary>
    [Fact]
    public Task Repeated_starts_reuse_the_handout_and_environment_anchors() => RunTestAsync(async service =>
    {
        // Two defenses of the same environment, then one of a second environment in the same handout
        await service.StartAsync(_ownerId, Request("prob-1", "first go"));
        await service.StartAsync(_ownerId, Request("prob-1", "second go"));
        await service.StartAsync(_ownerId, Request("prob-2", "a different problem"));

        // The handout was anchored once and reused by all three
        Assert.Equal(1, await QueryValueAsync(context => context.Handouts.CountAsync()));

        // And each distinct environment exactly once
        Assert.Equal(2, await QueryValueAsync(context => context.HandoutEnvironments.CountAsync()));
    });

    /// <summary>
    /// Rewinding to an examiner turn drops every later turn, leaving a contiguous prefix; a following continue then
    /// appends cleanly (no clash with the (session, sequence) unique index) and the freed turn budget lets it through.
    /// </summary>
    [Fact]
    public Task Rewind_truncates_and_lets_the_conversation_continue() => RunTestAsync(async service =>
    {
        // Open a session with the student's first message
        var session = await service.StartAsync(_ownerId, Request("prob-1", "first"));

        // Continue it to the two-student-turn cap: opener, student, examiner, student, examiner
        await service.ContinueAsync(_ownerId, session.Id, "second");

        // Rewind to the first examiner reply, dropping the second student turn and its reply
        await service.RewindAsync(_ownerId, session.Id, keepThroughSequence: 2);

        // Only the contiguous 0..2 prefix survives
        await QueryAsync(async context =>
        {
            // The session's turns in sequence order
            var turns = await context.DefenseTurns
                .Where(turn => turn.SessionId == session.Id)
                .OrderBy(turn => turn.Sequence)
                .ToListAsync();

            // The tail is gone and the kept sequences stay contiguous
            Assert.Equal([0, 1, 2], turns.Select(turn => turn.Sequence));
            Assert.Equal(
                [TranscriptRole.Examiner, TranscriptRole.Candidate, TranscriptRole.Examiner],
                turns.Select(turn => turn.Role));
        });

        // Continuing again lands the next student turn at sequence 3 without colliding, and the rewind freed the
        // turn budget that the pre-rewind conversation had already exhausted
        var continued = await service.ContinueAsync(_ownerId, session.Id, "redo");

        // The redone turn is appended after the kept prefix
        Assert.Equal(
            [
                TranscriptRole.Examiner, TranscriptRole.Candidate, TranscriptRole.Examiner,
                TranscriptRole.Candidate, TranscriptRole.Examiner,
            ],
            continued.Turns.Select(turn => turn.Role));

        // The new student turn holds what was sent the second time
        Assert.Equal("redo", continued.Turns[3].Content);
    });

    /// <summary>
    /// Rewinding to the conversation's already-last examiner turn is a harmless no-op — nothing is deleted.
    /// </summary>
    [Fact]
    public Task Rewind_to_the_last_examiner_turn_deletes_nothing() => RunTestAsync(async service =>
    {
        // A fresh three-turn session, whose last turn (sequence 2) is the examiner's reply
        var session = await service.StartAsync(_ownerId, Request("prob-1", "my defense"));

        // Rewind to that last examiner turn
        await service.RewindAsync(_ownerId, session.Id, keepThroughSequence: 2);

        // All three turns remain
        Assert.Equal(3, await QueryValueAsync(context =>
            context.DefenseTurns.CountAsync(turn => turn.SessionId == session.Id)));
    });

    /// <summary>
    /// A rewind whose cut point is out of range, or lands on a student turn, is refused and changes nothing.
    /// </summary>
    [Fact]
    public Task Rewind_to_an_invalid_target_is_refused() => RunTestAsync(async service =>
    {
        // A three-turn session: examiner(0), student(1), examiner(2)
        var session = await service.StartAsync(_ownerId, Request("prob-1", "my defense"));

        // A sequence past the last turn has no row to keep
        await Assert.ThrowsAsync<DefenseRewindTargetException>(
            () => service.RewindAsync(_ownerId, session.Id, keepThroughSequence: 99));

        // Keeping through the student turn would leave the conversation awaiting the examiner, not the student
        await Assert.ThrowsAsync<DefenseRewindTargetException>(
            () => service.RewindAsync(_ownerId, session.Id, keepThroughSequence: 1));

        // Both refusals left the conversation intact
        Assert.Equal(3, await QueryValueAsync(context =>
            context.DefenseTurns.CountAsync(turn => turn.SessionId == session.Id)));
    });

    /// <summary>
    /// A message over the length cap is refused before any turn is created.
    /// </summary>
    [Fact]
    public Task Over_length_message_is_refused() => RunTestAsync(async service =>
    {
        // A message past the 100-char cap
        var tooLong = new string('x', 101);

        // Starting with it is refused
        await Assert.ThrowsAsync<DefenseMessageTooLongException>(
            () => service.StartAsync(_ownerId, Request("prob-1", tooLong)));

        // Nothing was written
        Assert.Equal(0, await QueryValueAsync(context => context.DefenseSessions.CountAsync()));
    });

    /// <summary>
    /// A start that omits the target entirely is a bad request, not a server fault: the field arrives null through
    /// JSON, and dereferencing it would surface as a 500 instead of the refusal every other missing field gets.
    /// </summary>
    [Fact]
    public Task Missing_target_is_refused() => RunTestAsync(async service =>
    {
        // A start whose target never made it through the wire
        var start = new DefenseSessionStart(new StartDefenseRequest(null!, "my defense"), Language.EN);

        // Starting with it is refused the same way a blank field is
        await Assert.ThrowsAsync<DefenseMessageEmptyException>(
            () => service.StartAsync(_ownerId, start));

        // Nothing was written
        Assert.Equal(0, await QueryValueAsync(context => context.DefenseSessions.CountAsync()));
    });

    /// <summary>
    /// A start naming an environment the site has no content for is refused, and costs nothing: the lookup happens
    /// before the examiner runs, so a caller can't spend the model's budget on a problem that doesn't exist.
    /// </summary>
    [Fact]
    public Task Unknown_problem_is_refused() => RunTestAsync(async service =>
    {
        // An environment the published content doesn't carry
        _content.UnknownEnvironmentIds.Add("prob-gone");

        // Starting against it is refused
        await Assert.ThrowsAsync<DefenseEnvironmentNotFoundException>(
            () => service.StartAsync(_ownerId, Request("prob-gone", "my defense")));

        // No session, and no spend either
        Assert.Equal(0, await QueryValueAsync(context => context.DefenseSessions.CountAsync()));
        Assert.Equal(0, await QueryValueAsync(context => context.DefenseSpends.CountAsync()));
    });

    /// <summary>
    /// A handout content id longer than its anchor column is refused up front. The two ids have different caps, so
    /// a length that clears the environment half would still be too long to store as a handout id.
    /// </summary>
    [Fact]
    public Task Over_length_handout_content_id_is_refused() => RunTestAsync(async service =>
    {
        // Past the 30-char handout cap, but well inside the 200-char environment one
        var tooLong = new string('x', 31);

        // Starting against it is refused rather than failing the write
        await Assert.ThrowsAsync<DefenseMessageTooLongException>(
            () => service.StartAsync(_ownerId, Request("prob-1", "my defense", tooLong)));

        // No anchor row was minted for it either
        Assert.Equal(0, await QueryValueAsync(context => context.Handouts.CountAsync()));
    });

    /// <summary>
    /// A blank message is refused before any turn is created, on both start and continue.
    /// </summary>
    [Fact]
    public Task Blank_message_is_refused() => RunTestAsync(async service =>
    {
        // Starting with a whitespace-only message is refused
        await Assert.ThrowsAsync<DefenseMessageEmptyException>(
            () => service.StartAsync(_ownerId, Request("prob-1", "   ")));

        // Nothing was written for the rejected start
        Assert.Equal(0, await QueryValueAsync(context => context.DefenseSessions.CountAsync()));

        // A real session, so continue has something to reject against
        var session = await service.StartAsync(_ownerId, Request("prob-1", "my defense"));

        // Continuing it with an empty message is refused too
        await Assert.ThrowsAsync<DefenseMessageEmptyException>(
            () => service.ContinueAsync(_ownerId, session.Id, ""));
    });

    /// <summary>
    /// A continue past the student-turn cap is refused.
    /// </summary>
    [Fact]
    public Task Continue_past_the_turn_cap_is_refused() => RunTestAsync(async service =>
    {
        // Start the session — the first student turn
        var session = await service.StartAsync(_ownerId, Request("prob-1", "first"));

        // Continue once more, reaching the cap of two
        await service.ContinueAsync(_ownerId, session.Id, "second");

        // A third student turn is over the cap
        await Assert.ThrowsAsync<DefenseTurnLimitException>(
            () => service.ContinueAsync(_ownerId, session.Id, "third"));
    });

    /// <summary>
    /// A user already at their spend ceiling is refused before the engine runs, and the seeded spend counts even from
    /// a session that no longer exists.
    /// </summary>
    [Fact]
    public Task Over_spend_ceiling_is_refused() => RunTestAsync(async service =>
    {
        // Seed spend that meets the ceiling, unattached to any session
        await QueryAsync(async context =>
        {
            // A spend row that meets the ceiling
            context.DefenseSpends.Add(new DefenseSpend
            {
                UserId = _ownerId,
                Cost = 1.00m,
                PromptTokens = 0,
                CompletionTokens = 0,
                ReasoningTokens = 0,
                CachedPromptTokens = 0,
                DurationMs = 0,
                Revisions = 0,
                CreatedAt = DateTimeOffset.UtcNow,
            });

            // Commit the seeded spend
            await context.SaveChangesAsync();
        });

        // Starting a turn is refused
        await Assert.ThrowsAsync<DefenseSpendLimitException>(
            () => service.StartAsync(_ownerId, Request("prob-1", "my defense")));

        // And refused early enough that no conversation was created
        Assert.Equal(0, await QueryValueAsync(context => context.DefenseSessions.CountAsync()));
    });

    /// <summary>
    /// Spend stamped before today's UTC midnight is outside the daily window, so a user whose only spend is
    /// yesterday's can still start a turn even when it meets the ceiling.
    /// </summary>
    [Fact]
    public Task Spend_from_before_today_does_not_count_against_the_ceiling() => RunTestAsync(async service =>
    {
        // A spend at the ceiling, but stamped a second before today's midnight
        await QueryAsync(async context =>
        {
            // One row's worth of yesterday's spend
            context.DefenseSpends.Add(new DefenseSpend
            {
                UserId = _ownerId,
                Cost = 1.00m,
                PromptTokens = 0,
                CompletionTokens = 0,
                ReasoningTokens = 0,
                CachedPromptTokens = 0,
                DurationMs = 0,
                Revisions = 0,
                CreatedAt = new DateTimeOffset(DateTime.UtcNow.Date, TimeSpan.Zero) - TimeSpan.FromSeconds(1),
            });

            // Commit the seeded spend
            await context.SaveChangesAsync();
        });

        // Start a turn with the whole ceiling's worth of spend already on the books
        var session = await service.StartAsync(_ownerId, Request("prob-1", "my defense"));

        // Yesterday sits outside today's window, so none of it counted and the turn ran
        Assert.NotEmpty(session.Turns);
    });

    /// <summary>
    /// Two concurrent starts for one user just under the spend ceiling can't both slip through: the turn gate
    /// serializes them, so the second sees the first's committed spend and is refused. Without the gate, both
    /// would clear the check
    /// against the same pre-write total and both would open a session.
    /// </summary>
    [Fact]
    public Task Concurrent_turns_for_one_user_are_serialized_by_the_spend_gate() => RunTestAsync(async service =>
    {
        // Seed spend one turn short of the 1.00 ceiling, so exactly one more turn fits before it's reached
        await QueryAsync(async context =>
        {
            // A spend row one turn short of the ceiling
            context.DefenseSpends.Add(new DefenseSpend
            {
                UserId = _ownerId,
                Cost = 0.99m,
                PromptTokens = 0,
                CompletionTokens = 0,
                ReasoningTokens = 0,
                CachedPromptTokens = 0,
                DurationMs = 0,
                Revisions = 0,
                CreatedAt = DateTimeOffset.UtcNow,
            });

            // Commit the seeded spend
            await context.SaveChangesAsync();
        });

        // Fire two starts for the same user at once, capturing which cleared the ceiling and which was refused
        var outcomes = await Task.WhenAll(
            AttemptStartAsync(service, "one"),
            AttemptStartAsync(service, "two"));

        // Exactly one got through; the other was refused by the ceiling the first turn's spend pushed it to
        Assert.Equal(1, outcomes.Count(started => started));

        // And the stored state matches
        await QueryAsync(async context =>
        {
            // Only the one that got through opened a conversation
            Assert.Equal(1, await context.DefenseSessions.CountAsync());

            // Whose turn left a second spend row on top of the seeded one
            Assert.Equal(2, await context.DefenseSpends.CountAsync(spend => spend.UserId == _ownerId));
        });
    });

    /// <summary>
    /// A turn aborted after its calls have cost us still records the accrued spend — on its own row, with no session
    /// left behind — so the cost isn't lost to the cancel.
    /// </summary>
    [Fact]
    public Task Cancelled_turn_records_the_accrued_spend()
    {
        // An examiner that runs up cost, then the client aborts before it can finish.
        _examiner = CancellingAfterCost();

        // Start the turn and assert the abort still recorded it.
        return RunTestAsync(async service =>
        {
            // A token the examiner cancels mid-turn, as a client abort would.
            _abort = new CancellationTokenSource();

            // Starting runs the examiner, which runs up cost and then aborts.
            await Assert.ThrowsAsync<OperationCanceledException>(
                () => service.StartAsync(_ownerId, Request("prob-1", "my defense"), _abort.Token));

            // The abort still recorded the turn, and left no half-built conversation.
            await QueryAsync(async context =>
            {
                // The user's single spend row for the cancelled turn.
                var spend = Assert.Single(
                    await context.DefenseSpends.Where(row => row.UserId == _ownerId).ToListAsync());

                // It carries what the turn cost before it aborted, with no revision count to record.
                Assert.Equal(_cancelUsage.Cost, spend.Cost);
                Assert.Equal(_cancelUsage.PromptTokens, spend.PromptTokens);
                Assert.Equal(_cancelUsage.CompletionTokens, spend.CompletionTokens);
                Assert.Equal(0, spend.Revisions);

                // The aborted start persisted no session or turns.
                Assert.Equal(0, await context.DefenseSessions.CountAsync());
                Assert.Equal(0, await context.DefenseTurns.CountAsync());
            });
        });
    }

    /// <summary>
    /// A turn aborted before any call ran records nothing — the accrued-nothing guard keeps a junk row out.
    /// </summary>
    [Fact]
    public Task Cancel_before_any_call_bills_records_nothing()
    {
        // An examiner that aborts having run up nothing.
        _examiner = new CancellingExaminer(
            ModelUsage.Zero, () => new OperationCanceledException(), () => _abort?.Cancel());

        // Start the turn and assert no spend row lands.
        return RunTestAsync(async service =>
        {
            // A token the examiner cancels mid-turn, as a client abort would.
            _abort = new CancellationTokenSource();

            // Starting aborts before running any call.
            await Assert.ThrowsAsync<OperationCanceledException>(
                () => service.StartAsync(_ownerId, Request("prob-1", "my defense"), _abort.Token));

            // No call ran, so nothing was recorded.
            Assert.Equal(0, await QueryValueAsync(context =>
                context.DefenseSpends.CountAsync(row => row.UserId == _ownerId)));
        });
    }

    /// <summary>
    /// Repeatedly cancelling turns accumulates their cost until the daily ceiling is reached, at which point the next
    /// turn is refused — so a user can't dodge the ceiling by aborting every turn.
    /// </summary>
    [Fact]
    public Task Repeated_cancels_accumulate_until_the_ceiling_refuses()
    {
        // An examiner that runs up cost, then aborts, on every turn.
        _examiner = CancellingAfterCost();

        // Cancel repeatedly and assert the accrued spend eventually trips the ceiling.
        return RunTestAsync(async service =>
        {
            // Cancel enough turns to push the accrued spend over the ceiling; at 0.40 a turn, three reach 1.20.
            for (var attempt = 0; attempt < 3; attempt++)
            {
                // A fresh token each turn, cancelled mid-turn by the examiner.
                _abort = new CancellationTokenSource();

                // Starting runs the examiner, which runs up cost and then aborts.
                await Assert.ThrowsAsync<OperationCanceledException>(
                    () => service.StartAsync(_ownerId, Request("prob-1", "my defense"), _abort.Token));
            }

            // Each cancelled turn recorded its spend.
            Assert.Equal(3, await QueryValueAsync(context =>
                context.DefenseSpends.CountAsync(row => row.UserId == _ownerId)));

            // With the accrued cancels over the ceiling, the next turn is refused before the examiner runs.
            await Assert.ThrowsAsync<DefenseSpendLimitException>(
                () => service.StartAsync(_ownerId, Request("prob-1", "one more")));
        });
    }

    /// <summary>
    /// An OperationCanceledException whose request token never fired, the shape an upstream HTTP/LLM timeout
    /// takes,
    /// isn't recorded: it's our fault, not the user's, even though its calls cost us.
    /// </summary>
    [Fact]
    public Task An_upstream_timeout_is_not_charged()
    {
        // The turn runs up cost, then throws a cancellation without the request token ever being cancelled.
        _examiner = new CancellingExaminer(_cancelUsage, () => new OperationCanceledException());

        // Start with an uncancelled token and assert nothing is recorded.
        return RunTestAsync(async service =>
        {
            // The start surfaces the cancellation unchanged.
            await Assert.ThrowsAsync<OperationCanceledException>(
                () => service.StartAsync(_ownerId, Request("prob-1", "my defense")));

            // The token never fired, so it wasn't a client abort: nothing counts against the user's ceiling.
            Assert.Equal(0, await QueryValueAsync(context =>
                context.DefenseSpends.CountAsync(row => row.UserId == _ownerId)));
        });
    }

    /// <summary>
    /// A turn that fails for a reason other than a cancellation isn't recorded: the failure is our fault, not the
    /// user's, so it stays off their ceiling even though its calls cost us.
    /// </summary>
    [Fact]
    public Task A_non_cancellation_failure_is_not_charged()
    {
        // The turn runs up cost, then fails the way an exhausted-retry model error would.
        _examiner = new CancellingExaminer(_cancelUsage, () => new InvalidOperationException("model unavailable"));

        // Start the turn and assert nothing is recorded.
        return RunTestAsync(async service =>
        {
            // The start surfaces the failure unchanged.
            await Assert.ThrowsAsync<InvalidOperationException>(
                () => service.StartAsync(_ownerId, Request("prob-1", "my defense")));

            // No spend row: our fault doesn't count against the user's ceiling.
            Assert.Equal(0, await QueryValueAsync(context =>
                context.DefenseSpends.CountAsync(row => row.UserId == _ownerId)));
        });
    }

    /// <summary>
    /// An examiner that runs up the standard cancel cost, cancels the request mid-turn, then throws the cancellation —
    /// the shape a client abort takes once its calls have run.
    /// </summary>
    /// <returns>The cancelling examiner.</returns>
    private CancellingExaminer CancellingAfterCost() =>
        new(_cancelUsage, () => new OperationCanceledException(), () => _abort?.Cancel());

    /// <summary>
    /// Starts a session, reporting whether it cleared the spend ceiling (true) or was refused by it (false); any other
    /// failure propagates.
    /// </summary>
    /// <param name="service">The service under test.</param>
    /// <param name="content">The student's first message.</param>
    /// <returns>True when the start succeeded, false when the spend ceiling refused it.</returns>
    private static async Task<bool> AttemptStartAsync(IDefenseSessionService service, string content)
    {
        // A start clears the ceiling unless it throws the spend-limit refusal
        try
        {
            // Attempt the start
            await service.StartAsync(_ownerId, Request("prob-1", content));

            // It got through
            return true;
        }
        catch (DefenseSpendLimitException)
        {
            // The ceiling refused it
            return false;
        }
    }

    /// <summary>
    /// Builds a session start for an environment and student message. Every call shares one throwaway handout
    /// unless <paramref name="handoutContentId"/> is overridden, so <paramref name="environmentId"/> alone is
    /// enough to tell targets apart across most of these tests.
    /// </summary>
    /// <param name="environmentId">The environment's id within its handout.</param>
    /// <param name="content">The student's first message.</param>
    /// <param name="handoutContentId">The handout the environment belongs to.</param>
    /// <returns>The session start.</returns>
    private static DefenseSessionStart Request(
        string environmentId, string content, string handoutContentId = "handout-1") =>
        new(new StartDefenseRequest(new HandoutEnvironmentTarget(handoutContentId, environmentId), content),
            Language.EN);

    /// <summary>
    /// Builds a report against one of a conversation's replies, as the feedback service would write it.
    /// </summary>
    /// <param name="sessionId">The conversation the reported reply was given in.</param>
    /// <param name="turnId">The reported reply.</param>
    /// <param name="category">The way the reply went wrong.</param>
    /// <param name="comment">The student's own account of it, or null when they gave none.</param>
    /// <returns>The report, ready to add.</returns>
    /// <remarks>
    /// Built here rather than through the feedback service, which this suite doesn't register.
    /// </remarks>
    private static DefenseTurnReport NewReport(
        Guid sessionId, Guid turnId, DefenseReportCategory category, string? comment) => new()
        {
            SessionId = sessionId,
            TurnId = turnId,
            Categories = [category],
            Comment = comment,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
        };

    /// <summary>
    /// Builds a student's answer for a whole conversation, as the feedback service would write it.
    /// </summary>
    /// <param name="sessionId">The conversation being answered for.</param>
    /// <param name="outcome">What the examiner did for them.</param>
    /// <returns>The answer, ready to add.</returns>
    /// <inheritdoc cref="NewReport" path="/remarks"/>
    private static DefenseSessionFeedback NewFeedback(Guid sessionId, DefenseOutcome outcome) => new()
    {
        SessionId = sessionId,
        Outcome = outcome,
        Comment = null,
        CreatedAt = DateTimeOffset.UtcNow,
        UpdatedAt = DateTimeOffset.UtcNow,
    };

    /// <summary>
    /// A test double for <see cref="IDefenseContentResolver"/> standing in for the site's published handout
    /// content: every environment resolves to the same fixed problem, except the ones a test withholds.
    /// </summary>
    private sealed class FakeDefenseContentResolver : IDefenseContentResolver
    {
        /// <summary>
        /// The statement every resolved problem carries.
        /// </summary>
        public const string Statement = "the statement";

        /// <summary>
        /// The reference every resolved problem carries.
        /// </summary>
        private const string Reference = "the reference";

        /// <summary>
        /// Environment ids that resolve to nothing, standing in for a target the site has no content for.
        /// </summary>
        public HashSet<string> UnknownEnvironmentIds { get; } = new(StringComparer.Ordinal);

        /// <inheritdoc/>
        public Task<DefenseProblemContent?> ResolveAsync(
            HandoutEnvironmentTarget target, Language language, CancellationToken cancellationToken)
        {
            // A withheld environment resolves to nothing, as an unpublished or deleted one would
            if (UnknownEnvironmentIds.Contains(target.EnvironmentId))
                return Task.FromResult<DefenseProblemContent?>(null);

            // Otherwise the same fixed problem, whichever environment was asked for
            return Task.FromResult<DefenseProblemContent?>(
                new DefenseProblemContent(Statement, Reference, []));
        }
    }

    /// <summary>
    /// An examiner whose turn keeps leaking until the revision cap runs out and the constrained fallback ships, so a
    /// test has a real run to read back rather than the single clean attempt the plain fake produces.
    /// </summary>
    private sealed class DraftingExaminer : IExaminer
    {
        /// <inheritdoc/>
        public Task<ExaminerTurnOutcome> NextReplyAsync(
            string problem, string reference, Transcript transcript, ModelUsageAccumulator turnUsage,
            CancellationToken cancellationToken)
        {
            // The turn's cost, folded the way the real engine folds each call as it lands.
            turnUsage.Add(new ModelUsage(
                DraftCallCost * 3, PromptTokens: 30, CompletionTokens: 6, ReasoningTokens: 0,
                CachedPromptTokens: 0));

            // The first draft, sent back for handing over the counterexample.
            var rejected = new ExaminerAttempt(
                "a leaky draft.",
                RevisionNote: "",
                new MathCheckResult(true, ""),
                new LeakCheckResult(true, "the counterexample", false, ""),
                new LanguageCheckResult(false, "English"),
                [_draftCall],
                _draftDurationsMs[0]);

            // The second, written under the note that leak produced and giving the same thing away again.
            var revised = rejected with
            {
                Reply = "another leaky draft.",
                RevisionNote = DraftRevisionNote,
                DurationMs = _draftDurationsMs[1],
            };

            // The fallback the exhausted cap retreats to, which is what ships.
            var fallback = new ExaminerAttempt(
                "so what makes that step work?",
                DraftHoldNote,
                new MathCheckResult(true, ""),
                new LeakCheckResult(false, "", false, ""),
                new LanguageCheckResult(false, "English"),
                [_draftCall],
                _draftDurationsMs[2]);

            // The turn, ending on the fallback rather than on a draft that came back clean.
            return Task.FromResult(new ExaminerTurnOutcome(
                [rejected, revised, fallback], SafeFallback: true, turnUsage.Accrued));
        }
    }

    /// <summary>
    /// An examiner that runs up cost and then fails, standing in for a turn that dies mid-flight.
    /// </summary>
    /// <param name="usage">The cost to run up before failing.</param>
    /// <param name="failure">Builds the exception thrown after the cost is run up, fresh for each call.</param>
    /// <param name="abort">Cancels the request token before throwing, to model a client abort; null for a fault that
    /// isn't a cancellation of the caller's token.</param>
    private sealed class CancellingExaminer(ModelUsage usage, Func<Exception> failure, Action? abort = null) : IExaminer
    {
        /// <inheritdoc/>
        public Task<ExaminerTurnOutcome> NextReplyAsync(
            string problem, string reference, Transcript transcript, ModelUsageAccumulator turnUsage,
            CancellationToken cancellationToken)
        {
            // Run up the turn's cost the way the real engine folds each call as it lands.
            turnUsage.Add(usage);

            // Cancel the request mid-turn when the test wants a client abort, so the service sees its own token fire.
            abort?.Invoke();

            // Then fail before returning a reply, as a cancelled or erroring turn would.
            throw failure();
        }
    }
}

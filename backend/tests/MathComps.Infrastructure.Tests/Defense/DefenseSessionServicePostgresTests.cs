using MathComps.Domain.Contracts.Defense;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Options;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Ai;
using MathComps.Infrastructure.Services.Defense;
using MathComps.Infrastructure.Services.Defense.Engine;
using MathComps.Infrastructure.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace MathComps.Infrastructure.Tests.Defense;

/// <summary>
/// Integration tests for <see cref="DefenseSessionService"/> against a real PostgreSQL database, with a fake examiner
/// (fixed cost and tokens, no live LLM): the conversation flow (start, continue, list, delete), that each turn writes
/// an independent spend row that outlives the session, ownership isolation, and the guardrails (message length, turn
/// cap, per-user spend ceiling).
/// </summary>
/// <param name="fixture">The shared PostgreSQL container fixture.</param>
public class DefenseSessionServicePostgresTests(PostgresContainerFixture fixture)
    : PostgresTestBase<IDefenseSessionService>(fixture)
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

    /// <inheritdoc/>
    protected override void ConfigureServices(IServiceCollection services)
    {
        // A fake examiner so no LLM is called, reporting a fixed cost and tokens so a spend row is assertable.
        services.AddScoped<IExaminer>(_ => new FakeExaminer(new ModelUsage(TurnCost, PromptTokens: 150, CompletionTokens: 25)));

        // Tight caps so the guardrails are cheap to trip.
        services.Configure<DefenseLimits>(limits =>
        {
            limits.MaxCandidateChars = 100;
            limits.MaxStatementChars = 1000;
            limits.MaxReferenceChars = 1000;
            limits.MaxOpenerChars = 1000;
            limits.MaxProblemKeyChars = 200;
            limits.MaxTurnsPerSession = 2;
            limits.DailySpendCeilingPerUser = 1.00m;
        });

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
            new User { Id = _ownerId, ExternalId = "ext-owner", DisplayName = "Owner" },
            new User { Id = _otherId, ExternalId = "ext-other", DisplayName = "Other" });

        // Commit the seed.
        await context.SaveChangesAsync();
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
        Assert.Equal(["examiner", "student", "examiner"], session.Turns.Select(turn => turn.Role));
        Assert.Equal("the opener", session.Turns[0].Content);
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
            ["examiner", "student", "examiner", "student", "examiner"],
            continued.Turns.Select(turn => turn.Role));
        Assert.Equal("my next point", continued.Turns[3].Content);

        // Count the user's spend rows
        var spendCount = await QueryValueAsync(context =>
            context.DefenseSpends.CountAsync(spend => spend.UserId == _ownerId));

        // One row per turn — two in all
        Assert.Equal(2, spendCount);
    });

    /// <summary>
    /// Listing returns only the user's sessions for the given problem, in creation order.
    /// </summary>
    [Fact]
    public Task List_filters_by_user_and_problem() => RunTestAsync(async service =>
    {
        // Two problems for the owner, and one for the other user
        var first = await service.StartAsync(_ownerId, Request("prob-1", "first"));
        await service.StartAsync(_ownerId, Request("prob-2", "other problem"));
        await service.StartAsync(_otherId, Request("prob-1", "someone else"));

        // List the owner's sessions for problem 1
        var sessions = await service.ListAsync(_ownerId, "prob-1");

        // Only the owner's single prob-1 session comes back
        var listed = Assert.Single(sessions);
        Assert.Equal(first.Id, listed.Id);
    });

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
            ["examiner", "student", "examiner", "student", "examiner"],
            continued.Turns.Select(turn => turn.Role));
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
                DurationMs = 0,
                Revisions = 0,
                CreatedAt = DateTimeOffset.UtcNow,
            });

            // Commit the seeded spend
            await context.SaveChangesAsync();
        });

        // Starting a turn is refused before any conversation is created
        await Assert.ThrowsAsync<DefenseSpendLimitException>(
            () => service.StartAsync(_ownerId, Request("prob-1", "my defense")));
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
                DurationMs = 0,
                Revisions = 0,
                CreatedAt = new DateTimeOffset(DateTime.UtcNow.Date, TimeSpan.Zero) - TimeSpan.FromSeconds(1),
            });

            // Commit the seeded spend
            await context.SaveChangesAsync();
        });

        // Yesterday's spend is outside today's window, so the turn is allowed and the session is created
        var session = await service.StartAsync(_ownerId, Request("prob-1", "my defense"));
        Assert.NotEmpty(session.Turns);
    });

    /// <summary>
    /// Two concurrent starts for one user just under the spend ceiling can't both slip through: the turn gate serializes
    /// them, so the second sees the first's committed spend and is refused. Without the gate, both would clear the check
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

        // And the state matches: one session created, and one new spend row on top of the seeded one
        await QueryAsync(async context =>
        {
            Assert.Equal(1, await context.DefenseSessions.CountAsync());
            Assert.Equal(2, await context.DefenseSpends.CountAsync(spend => spend.UserId == _ownerId));
        });
    });

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
    /// Builds a start request for a problem and student message, with throwaway statement, reference, and opener.
    /// </summary>
    /// <param name="problemKey">The problem key.</param>
    /// <param name="content">The student's first message.</param>
    /// <returns>The start request.</returns>
    private static StartDefenseRequest Request(string problemKey, string content) =>
        new(problemKey, "the statement", "the reference", "the opener", content);
}

using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Competitions;
using MathComps.Infrastructure.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;

namespace MathComps.Infrastructure.Tests.Competitions;

/// <summary>
/// Covers <see cref="HostedEntryRules"/> against a real database. The rule is the embargo: it is asked by the
/// area serving a competition's problems and by the defense engine opening a conversation about one of them, so
/// it is pinned here on its own rather than incidentally through whichever consumer happens to call it.
/// </summary>
/// <remarks>
/// Both consumers ask about a round the caller named, and neither re-checks what the rule matched on. An entry
/// row satisfying the rule for the wrong round, or for the wrong student, therefore opens an embargoed set with
/// nothing downstream to stop it, which is why the two scoping tests below are the ones that matter most.
/// </remarks>
/// <param name="fixture">The shared PostgreSQL container fixture.</param>
public class HostedEntryRulesPostgresTests(PostgresContainerFixture fixture)
    : PostgresTestBase<IDbContextFactory<MathCompsDbContext>>(fixture)
{
    /// <summary>
    /// The student holding the one entry the seed creates.
    /// </summary>
    private readonly Guid _studentId = Guid.CreateVersion7();

    /// <summary>
    /// A student holding no entry at all.
    /// </summary>
    private readonly Guid _strangerId = Guid.CreateVersion7();

    /// <summary>
    /// The embargoed round the student holds their entry into.
    /// </summary>
    private readonly Guid _enteredRoundId = Guid.CreateVersion7();

    /// <summary>
    /// The other category of the same group, embargoed alike and entered by nobody.
    /// </summary>
    private readonly Guid _siblingRoundId = Guid.CreateVersion7();

    /// <summary>
    /// A round whose embargo has already lifted.
    /// </summary>
    private readonly Guid _openedRoundId = Guid.CreateVersion7();

    /// <summary>
    /// A round that was never embargoed, which is what the practice group's rounds are.
    /// </summary>
    private readonly Guid _neverEmbargoedRoundId = Guid.CreateVersion7();

    /// <summary>
    /// An embargoed round the student gave their entry up on rather than sitting it.
    /// </summary>
    private readonly Guid _forfeitedRoundId = Guid.CreateVersion7();

    /// <summary>
    /// An embargo that has not lifted refuses a student holding no entry at all, which is the rule's base case
    /// and the one the scoping tests below vary.
    /// </summary>
    [Fact]
    public Task An_embargoed_round_is_refused_without_an_entry() => RunTestAsync(async factory =>
        // Nothing spent, nothing to read
        await Assert.ThrowsAsync<HostedEntryRequiredException>(
            () => EnsureEntitledAsync(factory, _strangerId, _siblingRoundId)));

    /// <summary>
    /// An entry buys one competition and not the one beside it. Both categories of a group are embargoed until
    /// the same instant, so a rule that matched an entry without checking which round it was taken into would
    /// hand a student who entered the easy level the hard level's problems as well.
    /// </summary>
    [Fact]
    public Task An_entry_into_one_round_does_not_open_another() => RunTestAsync(async factory =>
        // The student holds an entry, just not into this one
        await Assert.ThrowsAsync<HostedEntryRequiredException>(
            () => EnsureEntitledAsync(factory, _studentId, _siblingRoundId)));

    /// <summary>
    /// An entry belongs to the student who spent it. A rule that only asked whether the round had been entered
    /// at all would open it to everybody the moment the first student walked in.
    /// </summary>
    [Fact]
    public Task Another_students_entry_does_not_open_the_round() => RunTestAsync(async factory =>
        // Somebody else's entry into exactly this round, which is not this student's to spend
        await Assert.ThrowsAsync<HostedEntryRequiredException>(
            () => EnsureEntitledAsync(factory, _strangerId, _enteredRoundId)));

    /// <summary>
    /// The student's own entry into the round they are asking about lets them through, which is the only way
    /// past an embargo that has not lifted.
    /// </summary>
    [Fact]
    public Task The_students_own_entry_opens_the_round() => RunTestAsync(async factory =>
        // The one pairing of student and round the seed created
        await EnsureEntitledAsync(factory, _studentId, _enteredRoundId));

    /// <summary>
    /// An entry given up opens the round exactly as a sat one does. The student is out of the results either
    /// way, so nothing is left to protect and they may keep working the problems and arguing them with the
    /// examiner, unranked.
    /// </summary>
    [Fact]
    public Task An_entry_given_up_opens_the_round_too() => RunTestAsync(async factory =>
        // Forfeited rather than sat, and the round opens all the same
        await EnsureEntitledAsync(factory, _studentId, _forfeitedRoundId));

    /// <summary>
    /// Once the instant has passed the problems are public, so no entry is asked for. This is what makes the
    /// gate a comparison against the clock rather than a permanent check for an entry.
    /// </summary>
    [Fact]
    public Task An_embargo_already_passed_asks_for_nothing() => RunTestAsync(async factory =>
        // A stranger, and the round opens to them anyway
        await EnsureEntitledAsync(factory, _strangerId, _openedRoundId));

    /// <summary>
    /// A round with no instant on it was never embargoed at all, which is separate from one whose instant has
    /// been and gone: the column is null rather than in the past.
    /// </summary>
    [Fact]
    public Task A_round_that_was_never_embargoed_asks_for_nothing() => RunTestAsync(async factory =>
        // No instant to compare against, so there is nothing to hold back
        await EnsureEntitledAsync(factory, _strangerId, _neverEmbargoedRoundId));

    /// <inheritdoc/>
    protected override async Task SeedDataAsync(MathCompsDbContext context)
    {
        // The two students the rule is asked about.
        context.Users.AddRange(
            new User { Id = _studentId, ExternalId = "ext-student", Username = "Student" },
            new User { Id = _strangerId, ExternalId = "ext-stranger", Username = "Stranger" });

        // The season every round below sits in.
        var season = new Season { Id = Guid.NewGuid(), StartYear = 2026, EditionNumber = 76 };
        context.Seasons.Add(season);

        // The root every round's competition path descends from.
        CompetitionTreeSeed.Root(context, "mc", 100);

        // When the embargoed rounds come out, which is far enough off that no test races it.
        var embargoedUntil = DateTimeOffset.UtcNow.AddYears(1);

        // The two rounds of one group, embargoed until the same instant: the pair the scoping tests need.
        SeedRound(context, season, _enteredRoundId, "mc-advanced", embargoedUntil);
        SeedRound(context, season, _siblingRoundId, "mc-elementary", embargoedUntil);

        // A round whose instant has been and gone.
        SeedRound(context, season, _openedRoundId, "mc-intermediate", DateTimeOffset.UtcNow.AddDays(-1));

        // A round that never had an instant at all.
        SeedRound(context, season, _neverEmbargoedRoundId, "mc", visibleSince: null);

        // And one still embargoed, which the student gave their entry up on.
        SeedRound(context, season, _forfeitedRoundId, "mc-open", embargoedUntil);

        // The one entry the whole file turns on: this student, this round, and nothing else.
        context.HostedEntries.Add(new HostedEntry
        {
            Id = Guid.CreateVersion7(),
            UserId = _studentId,
            RoundId = _enteredRoundId,
            StartedAt = DateTimeOffset.UtcNow,
        });

        // The same student's other entry, spent by giving it up: no clock ever started on it.
        context.HostedEntries.Add(new HostedEntry
        {
            Id = Guid.CreateVersion7(),
            UserId = _studentId,
            RoundId = _forfeitedRoundId,
            ForfeitedAt = DateTimeOffset.UtcNow,
        });

        // Submit changes
        await context.SaveChangesAsync();
    }

    /// <summary>
    /// Tracks one round under the node its path names. The rule reads a round's embargo and its entries and
    /// nothing else, so no group and no problems are seeded.
    /// </summary>
    /// <param name="context">The seeding context.</param>
    /// <param name="season">The season the round sits in.</param>
    /// <param name="roundId">The id the tests address the round by.</param>
    /// <param name="competitionPath">The node the round hangs off.</param>
    /// <param name="visibleSince"><inheritdoc cref="Round.VisibleSince" path="/summary"/></param>
    private static void SeedRound(
        MathCompsDbContext context, Season season, Guid roundId, string competitionPath,
        DateTimeOffset? visibleSince) =>
        context.Rounds.Add(new Round
        {
            Id = roundId,
            CompetitionId = CompetitionTreeSeed.Chain(context, competitionPath).Id,
            SeasonId = season.Id,
            Date = new DateOnly(2026, 10, 1),
            VisibleSince = visibleSince,
        });

    /// <summary>
    /// Asks the rule about one student and one round, reading the round's embargo the way both consumers do.
    /// </summary>
    /// <param name="factory">The factory minting the context the check runs on.</param>
    /// <param name="userId">The student reading.</param>
    /// <param name="roundId">The round they are reaching for.</param>
    private static async Task EnsureEntitledAsync(
        IDbContextFactory<MathCompsDbContext> factory, Guid userId, Guid roundId)
    {
        // A context of its own, as each consumer hands the rule.
        await using var context = await factory.CreateDbContextAsync();

        // The embargo the caller looks up before asking.
        var visibleSince = await context.Rounds
            .AsNoTracking()
            .Where(round => round.Id == roundId)
            .Select(round => round.VisibleSince)
            .FirstAsync();

        // The rule itself.
        await HostedEntryRules.EnsureEntitledAsync(
            context, userId, roundId, visibleSince, CancellationToken.None);
    }
}

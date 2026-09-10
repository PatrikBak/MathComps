using MathComps.Domain.Contracts.Defense;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Extensions;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Competitions;
using MathComps.Infrastructure.Services.Defense;
using MathComps.Infrastructure.Tests.TestInfrastructure;
using Microsoft.Extensions.DependencyInjection;

namespace MathComps.Infrastructure.Tests.Defense;

/// <summary>
/// Covers <see cref="DefenseTargetGuard"/>: the arms deciding whether a problem may be argued at all, and the
/// entry lookup deciding whether this student may argue an embargoed one. The rule that lookup feeds is pure and
/// pinned in <see cref="Competitions.HostedEntryRulesEntitlementTests"/>; what is covered here is the query, which
/// the guard writes itself.
/// </summary>
/// <remarks>
/// The guard takes a problem from the caller and never re-checks which round or student its entry lookup
/// matched, so a row satisfying it for the wrong round or the wrong student opens an embargoed problem with
/// nothing downstream to stop it. It also lifts the daily spend ceiling, which is why the scoping cases below
/// are the ones that matter most.
/// </remarks>
/// <param name="fixture">The shared PostgreSQL container fixture.</param>
public class DefenseTargetGuardPostgresTests(PostgresContainerFixture fixture)
    : PostgresTestBase<IDefenseTargetGuard>(fixture)
{
    /// <summary>
    /// The student holding neither an entry nor a grant.
    /// </summary>
    private readonly Guid _studentId = Guid.CreateVersion7();

    /// <summary>
    /// A student the site lets past the gates its competitions are entered through.
    /// </summary>
    private readonly Guid _grantedStudentId = Guid.CreateVersion7();

    /// <summary>
    /// A problem of the ordinary archive, sitting in a round no hosted group runs.
    /// </summary>
    private readonly Guid _archiveProblemId = Guid.CreateVersion7();

    /// <summary>
    /// A problem of a hosted round still under embargo, which nobody has spent an entry into.
    /// </summary>
    private readonly Guid _embargoedProblemId = Guid.CreateVersion7();

    /// <summary>
    /// A problem of a second hosted round, embargoed until the same instant, which the student does hold an
    /// entry into. What the scoping cases vary against the one above.
    /// </summary>
    private readonly Guid _enteredProblemId = Guid.CreateVersion7();

    /// <summary>
    /// A student holding an entry into the second round and none into the first.
    /// </summary>
    private readonly Guid _neighbourId = Guid.CreateVersion7();

    /// <summary>
    /// A student who gave their entry into the second round up for the problems rather than sitting it.
    /// </summary>
    private readonly Guid _forfeiterId = Guid.CreateVersion7();

    /// <inheritdoc/>
    protected override void ConfigureServices(IServiceCollection services)
    {
        // What the guard asks about the student asking.
        services.AddUserGrants();

        // The guard under test.
        services.AddScoped<IDefenseTargetGuard, DefenseTargetGuard>();
    }

    /// <summary>
    /// An ordinary archive problem cannot be argued, however public it is. That is a policy rather than a fact
    /// about the shape — the conversation would work — so nothing but this check enforces it, and it has to fire
    /// ahead of the embargo rule, which an archive round with no instant on it would pass straight through.
    /// </summary>
    [Fact]
    public Task An_archive_problem_the_site_does_not_host_cannot_be_argued() => RunTestAsync(async guard =>
        // A real problem, in a real round, that no hosted group runs
        await Assert.ThrowsAsync<HostedProblemNotFoundException>(
            () => guard.EnsureCanDefendAsync(_studentId, new ProblemTarget(_archiveProblemId))));

    /// <summary>
    /// A problem id naming nothing answers the same way a real but unhostable one does, rather than falling
    /// through the lookup into a null of its own.
    /// </summary>
    [Fact]
    public Task A_problem_id_that_names_nothing_cannot_be_argued() => RunTestAsync(async guard =>
        // An id the archive has never held
        await Assert.ThrowsAsync<HostedProblemNotFoundException>(
            () => guard.EnsureCanDefendAsync(_studentId, new ProblemTarget(Guid.CreateVersion7()))));

    /// <summary>
    /// An embargoed hosted problem cannot be argued by a student holding no entry into its round, which is the
    /// embargo rule reached through this guard.
    /// </summary>
    [Fact]
    public Task An_embargoed_hosted_problem_cannot_be_argued_without_an_entry() => RunTestAsync(
        async guard =>
            // Nothing spent on the round it sits in
            await Assert.ThrowsAsync<HostedEntryRequiredException>(
                () => guard.EnsureCanDefendAsync(_studentId, new ProblemTarget(_embargoedProblemId))));

    /// <summary>
    /// An entry buys the round it was taken into and not the one beside it. Both are embargoed until the same
    /// instant, so a guard matching an entry without checking which round it names would open an embargoed
    /// problem to anybody holding an entry anywhere, and lift the spend ceiling on it too.
    /// </summary>
    [Fact]
    public Task An_entry_into_one_round_does_not_open_a_problem_of_another() => RunTestAsync(
        async guard =>
            // An entry, just not into the round this problem sits in
            await Assert.ThrowsAsync<HostedEntryRequiredException>(
                () => guard.EnsureCanDefendAsync(_neighbourId, new ProblemTarget(_embargoedProblemId))));

    /// <summary>
    /// An entry belongs to the student who spent it. A guard asking only whether the round had been entered at
    /// all would open it to everybody once the first student walked in.
    /// </summary>
    [Fact]
    public Task Another_students_entry_does_not_open_the_problem() => RunTestAsync(async guard =>
        // The neighbour's entry is into exactly the round this problem sits in, and is not this student's
        await Assert.ThrowsAsync<HostedEntryRequiredException>(
            () => guard.EnsureCanDefendAsync(_studentId, new ProblemTarget(_enteredProblemId))));

    /// <summary>
    /// The student's own entry into the round a problem sits in opens it, and lifts the spend ceiling with it.
    /// The case the two above are varied from, so a guard that refused everybody would not pass them.
    /// </summary>
    [Fact]
    public Task The_students_own_entry_opens_the_problem() => RunTestAsync(async guard =>
        // Cleared, and the entry is what says the ceiling does not reach this conversation
        Assert.True(
            await guard.EnsureCanDefendAsync(_neighbourId, new ProblemTarget(_enteredProblemId))));

    /// <summary>
    /// An entry given up for the problems opens them to the examiner too. Giving it up is how a student reads
    /// an embargoed set without competing for it, so a lookup narrowed to a clock that ran would shut the
    /// conversation on exactly the problems the entry was spent to reach.
    /// </summary>
    [Fact]
    public Task An_entry_given_up_opens_the_problem_too() => RunTestAsync(async guard =>
        // Cleared on the round they forfeited into, and the entry lifts the ceiling whichever way it was spent
        Assert.True(
            await guard.EnsureCanDefendAsync(_forfeiterId, new ProblemTarget(_enteredProblemId))));

    /// <summary>
    /// A student let past the gates argues an embargoed problem holding no entry, and still counts against
    /// the daily spend ceiling. The grant says when a competition may be reached; what a conversation costs is the entry's to
    /// answer, and they hold none.
    /// </summary>
    [Fact]
    public Task A_granted_student_argues_an_embargoed_problem_and_still_pays_for_it() => RunTestAsync(
        async guard =>
        {
            // Cleared on a round nobody has entered
            var holdsEntry = await guard.EnsureCanDefendAsync(
                _grantedStudentId, new ProblemTarget(_embargoedProblemId));

            // And the ceiling still reaches them, an entry being what lifts it
            Assert.False(holdsEntry);
        });

    /// <summary>
    /// The grant does not make an archive problem arguable. Whether the site hosts a problem at all is settled
    /// before any question of timing, so a grant that reached it would open every problem on the site.
    /// </summary>
    [Fact]
    public Task A_granted_student_still_cannot_argue_an_archive_problem() => RunTestAsync(async guard =>
        // Let past the gates, and this problem was never one of the site's own
        await Assert.ThrowsAsync<HostedProblemNotFoundException>(
            () => guard.EnsureCanDefendAsync(_grantedStudentId, new ProblemTarget(_archiveProblemId))));

    /// <inheritdoc/>
    protected override async Task SeedDataAsync(MathCompsDbContext context)
    {
        // The students the checks are made as.
        context.Users.AddRange(
            new User { Id = _studentId, ExternalId = "ext-student", Username = "Student" },
            new User { Id = _grantedStudentId, ExternalId = "ext-granted", Username = "Granted" },
            new User { Id = _neighbourId, ExternalId = "ext-neighbour", Username = "Neighbour" },
            new User { Id = _forfeiterId, ExternalId = "ext-forfeiter", Username = "Forfeiter" });

        // The grant letting the granted student past those gates.
        context.UserGrants.Add(new UserGrant
        {
            UserId = _grantedStudentId,
            Capability = UserCapability.BypassCompetitionGates,
        });

        // The season the round below sits in.
        var season = new Season { Id = Guid.NewGuid(), StartYear = 2026, EditionNumber = 76 };
        context.Seasons.Add(season);

        // The roots the rounds' nodes hang off: the archive's, and the site's own.
        CompetitionTreeSeed.Root(context, "imo", 1);
        CompetitionTreeSeed.Root(context, "mathcomps", 100);

        // An ordinary archive round: no hosted group, and no embargo either, so the only thing that can refuse
        // its problem is the check for whether the site hosts it.
        var roundId = Guid.CreateVersion7();
        context.Rounds.Add(new Round
        {
            Id = roundId,
            CompetitionId = CompetitionTreeSeed.Chain(context, "imo").Id,
            SeasonId = season.Id,
            Date = new DateOnly(2026, 7, 1),
            VisibleSince = null,
        });

        // Its problem, the one the archive test argues.
        context.Problems.Add(new Problem
        {
            Id = _archiveProblemId,
            RoundId = roundId,
            Number = 1,
            Slug = "imo-2026-1",
        });

        // A group of the site's own, running now and not out for a year, which is when its problems come out.
        var closesAt = DateTimeOffset.UtcNow.AddYears(1);
        var group = new HostedGroup
        {
            Id = Guid.CreateVersion7(),
            Slug = "mc-hosted",
            OpensAt = DateTimeOffset.UtcNow.AddDays(-1),
            ClosesAt = closesAt,
            ClockMinutes = 180,
            AllowsReentry = false,
            ProblemCount = 1,
        };
        context.HostedGroups.Add(group);

        // Its round, embargoed until the group closes.
        var hostedRoundId = Guid.CreateVersion7();
        context.Rounds.Add(new Round
        {
            Id = hostedRoundId,
            CompetitionId = CompetitionTreeSeed.Chain(context, "mathcomps").Id,
            SeasonId = season.Id,
            Date = new DateOnly(2026, 10, 1),
            VisibleSince = closesAt,
            HostedGroupId = group.Id,
        });

        // And the problem the embargo cases argue, which nobody has spent an entry on.
        context.Problems.Add(new Problem
        {
            Id = _embargoedProblemId,
            RoundId = hostedRoundId,
            Number = 1,
            Slug = "mathcomps-2026-1",
        });

        // A second round of the same group, embargoed until the same instant: the other side of every
        // scoping case.
        var neighbourRoundId = Guid.CreateVersion7();
        context.Rounds.Add(new Round
        {
            Id = neighbourRoundId,
            CompetitionId = CompetitionTreeSeed.Chain(context, "mathcomps-elementary").Id,
            SeasonId = season.Id,
            Date = new DateOnly(2026, 10, 1),
            VisibleSince = closesAt,
            HostedGroupId = group.Id,
        });

        // Its problem, the one every entry below is spent into the round of.
        context.Problems.Add(new Problem
        {
            Id = _enteredProblemId,
            RoundId = neighbourRoundId,
            Number = 1,
            Slug = "mathcomps-elementary-2026-1",
        });

        // That entry, spent into the second round and no other.
        context.HostedEntries.Add(new HostedEntry
        {
            Id = Guid.CreateVersion7(),
            UserId = _neighbourId,
            RoundId = neighbourRoundId,
            StartedAt = DateTimeOffset.UtcNow,
        });

        // And one into the same round given up for the problems, so no clock ever ran on it.
        context.HostedEntries.Add(new HostedEntry
        {
            Id = Guid.CreateVersion7(),
            UserId = _forfeiterId,
            RoundId = neighbourRoundId,
            ForfeitedAt = DateTimeOffset.UtcNow,
        });

        // Submit changes
        await context.SaveChangesAsync();
    }
}

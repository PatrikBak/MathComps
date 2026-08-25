using MathComps.Domain.Contracts.Defense;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Defense;
using MathComps.Infrastructure.Tests.TestInfrastructure;
using Microsoft.Extensions.DependencyInjection;

namespace MathComps.Infrastructure.Tests.Defense;

/// <summary>
/// Covers the arms of <see cref="DefenseTargetGuard"/> that decide whether a problem may be argued at all,
/// before any question of who is asking. Which student may argue a hosted problem is the embargo rule, pinned in
/// <see cref="Competitions.HostedEntryRulesPostgresTests"/> and reached here only by delegation.
/// </summary>
/// <param name="fixture">The shared PostgreSQL container fixture.</param>
public class DefenseTargetGuardPostgresTests(PostgresContainerFixture fixture)
    : PostgresTestBase<IDefenseTargetGuard>(fixture)
{
    /// <summary>
    /// The student every check is made as. Which student it is never matters here.
    /// </summary>
    private readonly Guid _studentId = Guid.CreateVersion7();

    /// <summary>
    /// A problem of the ordinary archive, sitting in a round no hosted group runs.
    /// </summary>
    private readonly Guid _archiveProblemId = Guid.CreateVersion7();

    /// <inheritdoc/>
    protected override void ConfigureServices(IServiceCollection services) =>
        // The guard under test.
        services.AddScoped<IDefenseTargetGuard, DefenseTargetGuard>();

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

    /// <inheritdoc/>
    protected override async Task SeedDataAsync(MathCompsDbContext context)
    {
        // The student the checks are made as.
        context.Users.Add(new User { Id = _studentId, ExternalId = "ext-student", Username = "Student" });

        // The season the round below sits in.
        var season = new Season { Id = Guid.NewGuid(), StartYear = 2026, EditionNumber = 76 };
        context.Seasons.Add(season);

        // The root the round's node hangs off.
        CompetitionTreeSeed.Root(context, "imo", 1);

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

        // Submit changes
        await context.SaveChangesAsync();
    }
}

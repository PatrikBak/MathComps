using MathComps.Infrastructure.Tests.TestInfrastructure;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Extensions;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Problems;
using Microsoft.Extensions.DependencyInjection;

namespace MathComps.Infrastructure.Tests.Problems;

/// <summary>
/// Integration tests for the EF-backed <see cref="IProblemLookupService"/> using a shared PostgreSQL container.
/// Covers slug-to-id and slug-to-metadata resolution.
/// </summary>
/// <param name="fixture">The shared PostgreSQL container fixture.</param>
public class ProblemLookupServicePostgresTests(PostgresContainerFixture fixture)
    : PostgresTestBase<IProblemLookupService>(fixture)
{
    /// <inheritdoc/>
    protected override void ConfigureServices(IServiceCollection services) =>
        // Register the problem services module the test resolves from
        services.AddProblemServices();

    /// <summary>
    /// Slug of the seeded problem.
    /// </summary>
    private const string ProblemSlug = "lookup-problem";

    /// <summary>
    /// Slug of the seeded problem sitting four levels down.
    /// </summary>
    private const string DeepProblemSlug = "deep-lookup-problem";

    /// <summary>
    /// Slug of the seeded problem whose round is embargoed.
    /// </summary>
    private const string EmbargoedProblemSlug = "embargoed-lookup-problem";

    /// <summary>
    /// Verifies that slug-to-id resolution returns the row for a known slug and null for an unknown one.
    /// </summary>
    [Fact]
    public Task GetProblemIdBySlugResolvesKnownSlug() => RunTestAsync(async service =>
    {
        // A seeded slug resolves to its id
        Assert.True((await service.GetProblemIdBySlugAsync(ProblemSlug)).HasValue);

        // An unknown slug resolves to null
        Assert.Null(await service.GetProblemIdBySlugAsync("does-not-exist"));
    });

    /// <summary>
    /// Verifies that the detail-page metadata lookup returns the taxonomy slugs for a known slug and null otherwise.
    /// </summary>
    [Fact]
    public Task GetProblemLookupDataReturnsMetadataForKnownSlug() => RunTestAsync(async service =>
    {
        // A seeded slug yields its lookup metadata
        Assert.NotNull(await service.GetProblemLookupDataAsync(ProblemSlug));

        // An unknown slug yields null
        Assert.Null(await service.GetProblemLookupDataAsync("does-not-exist"));
    });

    /// <summary>
    /// Verifies that the lookup names the competition by its whole path, at whatever depth it sits.
    /// </summary>
    [Fact]
    public Task GetProblemLookupDataNamesTheCompetitionByItsWholePath() => RunTestAsync(async service =>
    {
        // A competition two levels down
        var shallow = await service.GetProblemLookupDataAsync(ProblemSlug);

        // The path names it whole
        Assert.Equal("testcomp-testround", shallow?.CompetitionPath);

        // One sitting four levels down
        var deep = await service.GetProblemLookupDataAsync(DeepProblemSlug);

        // The path keeps every level of it, at whatever depth the competition sits
        Assert.Equal("deep-mid-low-round", deep?.CompetitionPath);
    });

    /// <summary>
    /// Verifies that the two lookups disagree about an embargoed round, which is the asymmetry the interface
    /// promises: reading a problem is an archive read and refuses one, resolving a slug to an id serves the
    /// like/mark/list writes and answers for it.
    /// </summary>
    [Fact]
    public Task EmbargoedProblemIsUnreadableButStillAddressable() => RunTestAsync(async service =>
    {
        // The detail lookup treats it as though it were not there, so its page answers not-found
        Assert.Null(await service.GetProblemLookupDataAsync(EmbargoedProblemSlug));

        // The id lookup still resolves it, since a write against a problem nobody can read yet is allowed
        Assert.True((await service.GetProblemIdBySlugAsync(EmbargoedProblemSlug)).HasValue);
    });

    /// <inheritdoc />
    protected override async Task SeedDataAsync(MathCompsDbContext context)
    {
        // The season the round ran in.
        var season = new Season
        {
            Id = Guid.NewGuid(),
            StartYear = 2024,
            EditionNumber = 1
        };
        context.Seasons.Add(season);

        // The sitting of that competition in that season, under the node its path spells out.
        var round = new Round
        {
            Id = Guid.NewGuid(),
            CompetitionId = CompetitionTreeSeed.Chain(context, "testcomp-testround").Id,
            SeasonId = season.Id,
            Date = DateOnly.FromDateTime(DateTime.Today)
        };
        context.Rounds.Add(round);

        // One problem in the round
        context.Problems.Add(new Problem
        {
            RoundId = round.Id,
            Number = 1,
            Slug = ProblemSlug
        });

        // A second sitting, four levels down — a depth the three taxonomy slugs cannot spell between them.
        var deepRound = new Round
        {
            Id = Guid.NewGuid(),
            CompetitionId = CompetitionTreeSeed.Chain(context, "deep-mid-low-round").Id,
            SeasonId = season.Id,
            Date = DateOnly.FromDateTime(DateTime.Today)
        };
        context.Rounds.Add(deepRound);

        // One problem in it
        context.Problems.Add(new Problem
        {
            RoundId = deepRound.Id,
            Number = 1,
            Slug = DeepProblemSlug
        });

        // A third sitting, stamped to open well after any test run, so it stands in for an embargoed round.
        var embargoedRound = new Round
        {
            Id = Guid.NewGuid(),
            CompetitionId = CompetitionTreeSeed.Chain(context, "embargoed-round").Id,
            SeasonId = season.Id,
            Date = DateOnly.FromDateTime(DateTime.Today),
            VisibleSince = DateTimeOffset.UtcNow.AddYears(1)
        };
        context.Rounds.Add(embargoedRound);

        // One problem in it
        context.Problems.Add(new Problem
        {
            RoundId = embargoedRound.Id,
            Number = 1,
            Slug = EmbargoedProblemSlug
        });

        // Submit changes
        await context.SaveChangesAsync();
    }
}

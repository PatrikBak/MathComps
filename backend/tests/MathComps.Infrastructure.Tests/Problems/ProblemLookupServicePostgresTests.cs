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

    /// <inheritdoc />
    protected override async Task SeedDataAsync(MathCompsDbContext context)
    {
        // Competition → Season → Round → RoundInstance chain the problem hangs off
        var competition = new Competition
        {
            Id = Guid.NewGuid(),
            Slug = "test-comp",
            SortOrder = 1
        };
        context.Competitions.Add(competition);

        var season = new Season
        {
            Id = Guid.NewGuid(),
            StartYear = 2024,
            EditionNumber = 1
        };
        context.Seasons.Add(season);

        var round = new Round
        {
            Id = Guid.NewGuid(),
            CompetitionId = competition.Id,
            Slug = "test-round",
            CompositeSlug = "test-comp-test-round",
            SortOrder = 1,
            IsDefault = false
        };
        context.Rounds.Add(round);

        var roundInstance = new RoundInstance
        {
            Id = Guid.NewGuid(),
            RoundId = round.Id,
            SeasonId = season.Id,
            Date = DateOnly.FromDateTime(DateTime.Today)
        };
        context.RoundInstances.Add(roundInstance);

        // One problem in the round instance
        context.Problems.Add(new Problem
        {
            RoundInstanceId = roundInstance.Id,
            Number = 1,
            Slug = ProblemSlug
        });

        // Submit changes
        await context.SaveChangesAsync();
    }
}

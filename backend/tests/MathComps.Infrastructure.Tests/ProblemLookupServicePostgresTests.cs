using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services;

namespace MathComps.Infrastructure.Tests;

/// <summary>
/// Integration tests for the EF-backed <see cref="IProblemLookupService"/> using a shared PostgreSQL container.
/// Focuses on how the publication flag gates slug resolution for public vs. CLI/admin callers.
/// </summary>
/// <param name="fixture">The shared PostgreSQL container fixture.</param>
public class ProblemLookupServicePostgresTests(PostgresContainerFixture fixture)
    : PostgresTestBase<IProblemLookupService>(fixture)
{
    /// <summary>
    /// Slug of the published seeded problem.
    /// </summary>
    private const string PublishedSlug = "lookup-published";

    /// <summary>
    /// Slug of the unpublished seeded problem.
    /// </summary>
    private const string UnpublishedSlug = "lookup-unpublished";

    /// <summary>
    /// Verifies that the public detail-page lookup returns data for a published problem but not an unpublished one.
    /// </summary>
    [Fact]
    public Task GetProblemLookupDataReturnsNullForUnpublished() => RunTestAsync(async service =>
    {
        Assert.NotNull(await service.GetProblemLookupDataAsync(PublishedSlug));
        Assert.Null(await service.GetProblemLookupDataAsync(UnpublishedSlug));
    });

    /// <summary>
    /// Verifies that the published-only flag gates slug resolution: CLI/admin callers (the default) resolve
    /// any problem, while public callers passing publishedOnly never resolve an unpublished one.
    /// </summary>
    [Fact]
    public Task GetProblemIdBySlugRespectsPublishedOnlyFlag() => RunTestAsync(async service =>
    {
        // Default overload resolves any problem — this is what CLI enrichment relies on
        Assert.True((await service.GetProblemIdBySlugAsync(UnpublishedSlug)).HasValue);

        // Public callers must not resolve an unpublished problem
        Assert.False((await service.GetProblemIdBySlugAsync(UnpublishedSlug, publishedOnly: true)).HasValue);

        // A published problem resolves regardless of the flag
        Assert.True((await service.GetProblemIdBySlugAsync(PublishedSlug, publishedOnly: true)).HasValue);
    });

    /// <inheritdoc />
    protected override async Task SeedDataAsync(MathCompsDbContext context)
    {
        // Competition → Season → Round → RoundInstance chain shared by both problems
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

        // One published and one unpublished problem in the same round instance
        context.Problems.Add(new Problem
        {
            RoundInstanceId = roundInstance.Id,
            Number = 1,
            Slug = PublishedSlug
        });
        context.Problems.Add(new Problem
        {
            RoundInstanceId = roundInstance.Id,
            Number = 2,
            Slug = UnpublishedSlug,
            IsPublished = false
        });

        // Submit changes
        await context.SaveChangesAsync();
    }
}

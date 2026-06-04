using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.BulkImport;
using MathComps.Infrastructure.Persistence;

namespace MathComps.Infrastructure.Tests;

/// <summary>
/// Integration tests for <see cref="DraftResolutionService"/> against a real Postgres database. These pin the EF
/// query field mappings a pure slug test can't reach — the round lookup keys on <c>CompositeSlug</c> (category
/// included), the season on <c>StartYear</c>, the collision check on <c>Problem.Slug</c> — and that each entity
/// resolves independently, so a draft can reuse some of its taxonomy while creating the rest.
/// </summary>
/// <param name="fixture">The shared PostgreSQL container fixture.</param>
public class DraftResolutionServicePostgresTests(PostgresContainerFixture fixture)
    : PostgresTestBase<IDraftResolutionService>(fixture)
{
    /// <summary>
    /// The slug of the one seeded problem — the draft's first problem would collide with it.
    /// </summary>
    private const string SeededProblemSlug = "2024-csmo-a-iii-1";

    /// <inheritdoc/>
    protected override async Task SeedDataAsync(MathCompsDbContext context)
    {
        // One existing CSMO category-A national round in the 2024 season, carrying a single problem.
        var competition = new Competition { Id = Guid.NewGuid(), Slug = "csmo", SortOrder = 1 };
        context.Competitions.Add(competition);

        // Season keyed on its start year.
        var season = new Season { Id = Guid.NewGuid(), StartYear = 2024, EditionNumber = 74 };
        context.Seasons.Add(season);

        // Round keyed on its composite slug; category is irrelevant to the lookup, so leave it null.
        var round = new Round
        {
            Id = Guid.NewGuid(),
            CompetitionId = competition.Id,
            Slug = "iii",
            CompositeSlug = "csmo-a-iii",
            SortOrder = 1,
            IsDefault = false
        };
        context.Rounds.Add(round);

        // The round-instance the problem hangs off.
        var roundInstance = new RoundInstance
        {
            Id = Guid.NewGuid(),
            RoundId = round.Id,
            SeasonId = season.Id,
            Date = new DateOnly(2024, 3, 15)
        };
        context.RoundInstances.Add(roundInstance);

        // The one existing problem, whose slug a re-import would clash with.
        context.Problems.Add(new Problem
        {
            RoundInstanceId = roundInstance.Id,
            Number = 1,
            Slug = SeededProblemSlug
        });

        // A category-less competition and round, so the null-category composite slug ("memo-i") gets exercised.
        var memo = new Competition { Id = Guid.NewGuid(), Slug = "memo", SortOrder = 2 };
        context.Competitions.Add(memo);
        context.Rounds.Add(new Round
        {
            Id = Guid.NewGuid(),
            CompetitionId = memo.Id,
            Slug = "i",
            CompositeSlug = "memo-i",
            SortOrder = 1,
            IsDefault = false
        });

        // Persist the chain.
        await context.SaveChangesAsync();
    }

    /// <summary>
    /// A draft targeting the seeded round reuses every taxonomy entity, and flags exactly the problem slug that
    /// already exists (order 1 collides; order 2 doesn't).
    /// </summary>
    [Fact]
    public Task Existing_taxonomy_is_reused_and_the_clashing_slug_is_flagged() => RunTestAsync(async service =>
    {
        // Preview a two-problem draft against the seeded csmo/a/iii · 2024 round.
        var preview = await service.PreviewAsync(new DraftTarget("csmo", "a", "iii", 2024), [1, 2]);

        // All three taxonomy entities already exist, so all reuse.
        Assert.Equal(ResolutionAction.Reuse, ActionFor(preview, "competition"));
        Assert.Equal(ResolutionAction.Reuse, ActionFor(preview, "season"));
        Assert.Equal(ResolutionAction.Reuse, ActionFor(preview, "round"));

        // Only the first problem's slug is already taken.
        Assert.Equal([SeededProblemSlug], preview.CollidingProblemSlugs.AsEnumerable());
    });

    /// <summary>
    /// A draft for an unseen competition / season / round reports all three as creates, with no slug collisions.
    /// </summary>
    [Fact]
    public Task Unknown_taxonomy_is_reported_as_creates_with_no_collisions() => RunTestAsync(async service =>
    {
        // Preview a draft whose competition, round and season are all absent.
        var preview = await service.PreviewAsync(new DraftTarget("newcomp", null, "i", 2099), [1]);

        // Nothing exists yet, so all three would be created.
        Assert.Equal(ResolutionAction.Create, ActionFor(preview, "competition"));
        Assert.Equal(ResolutionAction.Create, ActionFor(preview, "season"));
        Assert.Equal(ResolutionAction.Create, ActionFor(preview, "round"));

        // And no problem slug clashes.
        Assert.Empty(preview.CollidingProblemSlugs);
    });

    /// <summary>
    /// Each entity resolves independently: a draft reusing the seeded competition and round but in a brand-new
    /// season reports the season alone as a create, and the new year sidesteps the existing slug.
    /// </summary>
    [Fact]
    public Task A_new_season_under_an_existing_competition_and_round_creates_only_the_season() => RunTestAsync(async service =>
    {
        // Same csmo/a/iii round, but the 2025 season doesn't exist yet.
        var preview = await service.PreviewAsync(new DraftTarget("csmo", "a", "iii", 2025), [1]);

        // Competition and round are reused; only the season is new.
        Assert.Equal(ResolutionAction.Reuse, ActionFor(preview, "competition"));
        Assert.Equal(ResolutionAction.Create, ActionFor(preview, "season"));
        Assert.Equal(ResolutionAction.Reuse, ActionFor(preview, "round"));

        // The 2025 slug is distinct from the seeded 2024 one, so no clash.
        Assert.Empty(preview.CollidingProblemSlugs);
    });

    /// <summary>
    /// The category is part of the round key: the same competition and round under a different category resolves
    /// to a different composite slug, so the round reads as a create.
    /// </summary>
    [Fact]
    public Task A_different_category_resolves_to_a_new_round() => RunTestAsync(async service =>
    {
        // csmo/b/iii composes to "csmo-b-iii", which isn't the seeded "csmo-a-iii".
        var preview = await service.PreviewAsync(new DraftTarget("csmo", "b", "iii", 2024), [1]);

        // The competition and season still exist; the differently-keyed round does not.
        Assert.Equal(ResolutionAction.Reuse, ActionFor(preview, "competition"));
        Assert.Equal(ResolutionAction.Reuse, ActionFor(preview, "season"));
        Assert.Equal(ResolutionAction.Create, ActionFor(preview, "round"));
    });

    /// <summary>
    /// A category-less competition's round resolves by the category-less composite slug ("memo-i"), so the
    /// seeded round is reused.
    /// </summary>
    [Fact]
    public Task A_category_less_round_resolves_by_its_composite_slug() => RunTestAsync(async service =>
    {
        // memo/(no category)/i composes to "memo-i", which is seeded.
        var preview = await service.PreviewAsync(new DraftTarget("memo", null, "i", 2024), [1]);

        // All three exist, so all reuse — proving the null-category composite matched the stored slug.
        Assert.Equal(ResolutionAction.Reuse, ActionFor(preview, "competition"));
        Assert.Equal(ResolutionAction.Reuse, ActionFor(preview, "season"));
        Assert.Equal(ResolutionAction.Reuse, ActionFor(preview, "round"));
    });

    /// <summary>
    /// Pulls the resolution action for a given entity kind out of a preview.
    /// </summary>
    /// <param name="preview">The preview to read.</param>
    /// <param name="entityKind">The entity kind (<c>competition</c>, <c>season</c>, <c>round</c>).</param>
    /// <returns>That entity's create-vs-reuse action.</returns>
    private static ResolutionAction ActionFor(DraftDbPreview preview, string entityKind) =>
        preview.Entities.Single(entity => entity.EntityKind == entityKind).Action;
}

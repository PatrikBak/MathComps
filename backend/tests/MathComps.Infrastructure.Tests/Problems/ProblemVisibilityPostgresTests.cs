using MathComps.Domain.Contracts.Helpers;
using MathComps.Domain.Contracts.ProblemQuery;
using MathComps.Domain.Contracts.SearchBar;
using MathComps.Domain.EfCoreEntities;
using MathComps.Domain.Localization;
using MathComps.Domain.Tagging;
using MathComps.Infrastructure.Extensions;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Problems;
using MathComps.Infrastructure.Tests.TestInfrastructure;
using Microsoft.Extensions.DependencyInjection;

namespace MathComps.Infrastructure.Tests.Problems;

/// <summary>
/// Integration tests for the round embargo: that a round stamped to open later is absent from everything the
/// archive serves, and that one whose instant has passed is served like any other.
/// </summary>
/// <remarks>
/// A class of its own rather than more facts on <see cref="ProblemFilterServicePostgresTests"/>, whose seed is
/// pinned by exact counts across dozens of assertions that an extra round would all move. The seed here is built
/// so each hidden problem's tag, author and number are its alone: a facet that leaked would have to show them.
/// </remarks>
/// <param name="fixture">The shared PostgreSQL container fixture.</param>
public class ProblemVisibilityPostgresTests(PostgresContainerFixture fixture)
    : PostgresTestBase<IProblemFilterService>(fixture)
{
    /// <inheritdoc/>
    protected override void ConfigureServices(IServiceCollection services) =>
        // Register the problem services module the test resolves from
        services.AddProblemServices();

    /// <summary>
    /// Slug of the problem whose round carries no stamp at all.
    /// </summary>
    private const string OpenSlug = "75-csmo-a-i-1";

    /// <summary>
    /// Slug of the problem whose round was stamped to open in the past.
    /// </summary>
    private const string OpenedSlug = "75-csmo-a-iii-2";

    /// <summary>
    /// Slug of the problem whose round is stamped to open long after any test run.
    /// </summary>
    private const string EmbargoedSlug = "75-csmo-a-ii-3";

    /// <summary>
    /// Verifies that the page holds both open rounds' problems and none of the embargoed round's.
    /// </summary>
    [Fact]
    public Task An_embargoed_rounds_problems_are_absent_from_the_page() => RunTestAsync(async service =>
    {
        // Ask the library for everything it holds
        var result = await service.FilterAsync(EverythingQuery());

        // Only the two open rounds answer
        Assert.Equal([OpenSlug, OpenedSlug], result.Problems.Items.Select(problem => problem.Slug).Order());

        // And the total agrees, so the embargoed one is filtered rather than merely paged out
        Assert.Equal(2, result.Problems.TotalCount);
    });

    /// <summary>
    /// Verifies that a stamp already in the past leaves its round open. This is what makes the embargo a
    /// comparison against the clock rather than a null check that any stamp at all would fail.
    /// </summary>
    [Fact]
    public Task A_round_whose_instant_has_passed_is_served() => RunTestAsync(async service =>
    {
        // Ask the library for everything it holds
        var result = await service.FilterAsync(EverythingQuery());

        // The round stamped to open yesterday is served just like the one carrying no stamp
        Assert.Contains(result.Problems.Items, problem => problem.Slug == OpenedSlug);
    });

    /// <summary>
    /// Verifies that no facet counts an embargoed round's problems. Each of them is the only holder of its tag,
    /// author and number, so a facet that reached past the gate would have to advertise one.
    /// </summary>
    [Fact]
    public Task No_facet_counts_an_embargoed_rounds_problems() => RunTestAsync(async service =>
    {
        // Ask the library for everything it holds, which is the request that builds the base options
        var result = await service.FilterAsync(EverythingQuery());

        // The base options are built on a first-page request that asks for them
        Assert.NotNull(result.BaseOptions);

        // What the archive offers the whole library to be filtered by
        var options = result.BaseOptions;

        // The embargoed problem's tag is its alone, so the tag facet must not know it
        Assert.DoesNotContain(options.Tags, tag => tag.Slug == "number-theory");

        // Nor its author
        Assert.DoesNotContain(options.Authors, author => author.Slug == "carol-hidden");

        // Nor its number
        Assert.DoesNotContain(options.ProblemNumbers, number => number.Slug == "3");

        // Its competition holds nothing else either, so the tree must not carry that node
        Assert.DoesNotContain(CompetitionPaths(options.Competitions), path => path == "csmo-a-ii");

        // The season is shared with the open rounds, so it stays
        var season = Assert.Single(options.Seasons);

        // Counting only the problems that can be reached through it
        Assert.Equal(2, season.Count);
    });

    /// <summary>
    /// Verifies that the competition browser, which reads the problems on its own rather than through the filter,
    /// leaves an embargoed round out too.
    /// </summary>
    [Fact]
    public Task The_competition_browser_leaves_an_embargoed_round_out() => RunTestAsync(async service =>
    {
        // The browser's own view of the library
        var result = await service.GetCompetitionsBySeasonAsync(Language.SK);

        // The one season the seed holds
        var season = Assert.Single(result.Seasons);

        // Only the two open rounds' competitions are offered
        Assert.Equal(
            ["csmo-a-i", "csmo-a-iii"],
            season.Competitions.Select(competition => competition.Path).Order());

        // And they carry one problem each, so the embargoed one is counted nowhere
        Assert.All(season.Competitions, competition => Assert.Equal(1, competition.ProblemCount));
    });

    /// <summary>
    /// Verifies that a similar-problem edge cannot carry an embargoed neighbour out beside a visible problem.
    /// This is the one place the gate reaches the edges between problems rather than the problems themselves.
    /// </summary>
    [Fact]
    public Task A_similar_problem_edge_does_not_surface_an_embargoed_neighbour() => RunTestAsync(async service =>
    {
        // Ask the library for everything it holds
        var result = await service.FilterAsync(EverythingQuery());

        // The problem both edges hang off
        var open = result.Problems.Items.Single(problem => problem.Slug == OpenSlug);

        // Its visible neighbour comes through, and the embargoed one is dropped along with its statement
        Assert.Equal([OpenedSlug], open.SimilarProblems.Select(similar => similar.Slug));
    });

    /// <summary>
    /// Flattens a competition facet tree into the paths it names, at every depth.
    /// </summary>
    /// <param name="competitions">The roots of the tree.</param>
    /// <returns>Every path the tree carries.</returns>
    private static IEnumerable<string> CompetitionPaths(IEnumerable<CompetitionNodeOption> competitions) =>
        competitions.SelectMany(competition => CompetitionPaths(competition.Children).Prepend(competition.Path));

    /// <summary>
    /// A query that asks the library for everything it holds.
    /// </summary>
    /// <returns>The query.</returns>
    private static ProblemFilterOptions EverythingQuery() => new(
        new FilterQuery(
            new FilterParameters(
                SearchText: string.Empty,
                SearchInSolution: false,
                OlympiadYears: [],
                CompetitionPaths: [],
                ProblemNumbers: [],
                TagSlugs: [],
                TagLogic: LogicToggle.Or,
                AuthorSlugs: [],
                AuthorLogic: LogicToggle.Or),
            PageSize: 10,
            PageNumber: 1,
            FavoritesOnly: false,
            IncludeBaseOptions: true),
        UserId: null,
        Language: Language.SK);

    /// <inheritdoc />
    protected override async Task SeedDataAsync(MathCompsDbContext context)
    {
        // The one season all three rounds sat in, so the season facet can show what it still counts.
        var season = new Season
        {
            Id = Guid.NewGuid(),
            StartYear = 2025,
            EditionNumber = 75
        };
        context.Seasons.Add(season);

        // The competition the three rounds hang under, placed as a root so its children sort beneath it.
        CompetitionTreeSeed.Root(context, "csmo", 100);

        // A round carrying no stamp, which is the ordinary case and the one the archive must keep serving.
        var openRound = Round(context, season, "csmo-a-i", new DateOnly(2025, 9, 1), visibleSince: null);

        // A round stamped to open long after any test run, which is the embargo itself.
        var embargoedRound = Round(
            context, season, "csmo-a-ii", new DateOnly(2025, 9, 2), DateTimeOffset.UtcNow.AddYears(1));

        // A round whose stamp has already passed, which the archive must treat as open.
        var openedRound = Round(
            context, season, "csmo-a-iii", new DateOnly(2025, 9, 3), DateTimeOffset.UtcNow.AddDays(-1));

        // One author per problem, so an author surfacing at all names which problem leaked.
        var alice = Author(context, "Alice Open", "alice-open");
        var bob = Author(context, "Bob Opened", "bob-opened");
        var carol = Author(context, "Carol Hidden", "carol-hidden");

        // One tag per problem, so a tag surfacing at all names which problem leaked.
        var algebra = Tag(context, "algebra");
        var geometry = Tag(context, "geometry");
        var numberTheory = Tag(context, "number-theory");

        // The problem in the unstamped round.
        var open = Problem(context, OpenSlug, openRound, number: 1, alice, algebra, "Nech je dané prvočíslo.");

        // The problem in the round that has already opened.
        var opened = Problem(context, OpenedSlug, openedRound, number: 2, bob, geometry, "Nech je daný trojuholník.");

        // The problem nobody may read yet.
        var embargoed = Problem(
            context, EmbargoedSlug, embargoedRound, number: 3, carol, numberTheory, "Nech je dané celé číslo.");

        // Both edges hang off the visible problem and score well past the threshold, so only the gate can drop one.
        open.SimilarProblems.Add(new ProblemSimilarity
        {
            SourceProblemId = open.Id,
            SimilarProblemId = opened.Id,
            SimilarityScore = 0.95
        });
        open.SimilarProblems.Add(new ProblemSimilarity
        {
            SourceProblemId = open.Id,
            SimilarProblemId = embargoed.Id,
            SimilarityScore = 0.99
        });

        // Submit changes
        await context.SaveChangesAsync();
    }

    /// <summary>
    /// Tracks one round of a competition in a season, raising the competition chain its path names.
    /// </summary>
    /// <param name="context">The seeding context.</param>
    /// <param name="season">The season the round sat in.</param>
    /// <param name="competitionPath">The path of the competition the round is a sitting of.</param>
    /// <param name="date"><inheritdoc cref="Round.Date" path="/summary"/></param>
    /// <param name="visibleSince"><inheritdoc cref="Round.VisibleSince" path="/summary"/></param>
    /// <returns>The tracked round.</returns>
    private static Round Round(
        MathCompsDbContext context,
        Season season,
        string competitionPath,
        DateOnly date,
        DateTimeOffset? visibleSince)
    {
        // The round under the deepest competition its path names.
        var round = new Round
        {
            Id = Guid.NewGuid(),
            CompetitionId = CompetitionTreeSeed.Chain(context, competitionPath).Id,
            SeasonId = season.Id,
            Date = date,
            VisibleSince = visibleSince
        };
        context.Rounds.Add(round);

        // The tracked round
        return round;
    }

    /// <summary>
    /// Tracks one author.
    /// </summary>
    /// <param name="context">The seeding context.</param>
    /// <param name="name">The author's display name.</param>
    /// <param name="slug">The author's slug.</param>
    /// <returns>The tracked author.</returns>
    private static Author Author(MathCompsDbContext context, string name, string slug)
    {
        // The author row
        var author = new Author { Id = Guid.NewGuid(), Name = name, Slug = slug };
        context.Authors.Add(author);

        // The tracked author
        return author;
    }

    /// <summary>
    /// Tracks one area tag.
    /// </summary>
    /// <param name="context">The seeding context.</param>
    /// <param name="slug">The tag's slug.</param>
    /// <returns>The tracked tag.</returns>
    private static Tag Tag(MathCompsDbContext context, string slug)
    {
        // The tag row
        var tag = new Tag { Id = Guid.NewGuid(), Slug = slug, TagType = TagType.Area };
        context.Tags.Add(tag);

        // The tracked tag
        return tag;
    }

    /// <summary>
    /// Tracks one problem with a Slovak statement, a single author and a single tag.
    /// </summary>
    /// <param name="context">The seeding context.</param>
    /// <param name="slug">The problem's slug.</param>
    /// <param name="round">The round the problem belongs to.</param>
    /// <param name="number">The problem's number within its competition.</param>
    /// <param name="author">The problem's sole author.</param>
    /// <param name="tag">The problem's sole tag.</param>
    /// <param name="statement">The statement text, in Slovak.</param>
    /// <returns>The tracked problem.</returns>
    private static Problem Problem(
        MathCompsDbContext context,
        string slug,
        Round round,
        int number,
        Author author,
        Tag tag,
        string statement)
    {
        // The problem row
        var problem = new Problem
        {
            Id = Guid.NewGuid(),
            Slug = slug,
            RoundId = round.Id,
            Number = number
        };

        // Its statement, which is also what a text search would match on
        problem.Texts.Add(new ProblemText
        {
            Id = Guid.NewGuid(),
            ProblemId = problem.Id,
            DocumentType = DocumentType.Statement,
            RawText = statement,
            MarkdownText = statement,
            Language = Language.SK,
            DateModified = DateTime.UtcNow,
            IsOriginal = true
        });

        // Its author
        problem.ProblemAuthors.Add(new ProblemAuthor
        {
            ProblemId = problem.Id,
            AuthorId = author.Id,
            Ordinal = 1
        });

        // Its tag, fitting well enough to reach the facet
        problem.ProblemTagsAll.Add(new ProblemTag
        {
            ProblemId = problem.Id,
            TagId = tag.Id,
            GoodnessOfFit = 1.0f
        });

        // Track it
        context.Problems.Add(problem);

        // The tracked problem
        return problem;
    }
}

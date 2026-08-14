using MathComps.Infrastructure.Tests.TestInfrastructure;
using MathComps.Domain.Contracts.Helpers;
using MathComps.Domain.Contracts.ProblemQuery;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Extensions;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Problems;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MathComps.Domain.Localization;
using MathComps.Domain.Tagging;
using MathComps.Domain.Taxonomy;

namespace MathComps.Infrastructure.Tests.Problems;

/// <summary>
/// Integration tests for the EF-backed <see cref="IProblemFilterService"/> using a shared PostgreSQL container.
/// </summary>
/// <param name="fixture">The shared PostgreSQL container fixture.</param>
public class ProblemFilterServicePostgresTests(PostgresContainerFixture fixture)
    : PostgresTestBase<IProblemFilterService>(fixture)
{
    /// <inheritdoc/>
    protected override void ConfigureServices(IServiceCollection services) =>
        // Register the problem services module the test resolves from
        services.AddProblemServices();

    /// <summary>
    /// Verifies that an initial load with no filters returns all problems and available filter options.
    /// This test ensures the service correctly handles the baseline case where no filtering is applied,
    /// returning the complete dataset along with all available filter options for the UI.
    /// </summary>
    [Fact]
    public Task FilterInitialLoadReturnsAllProblemsAndOptions() => RunTestAsync(async service =>
    {
        // Arrange - create a query with no filters to test the baseline behavior
        var initialQuery = new ProblemFilterOptions(
            new ProblemFilterQuery(
                new ProblemFilterCriteria(
                    SearchText: string.Empty,
                    SearchInSolution: false,
                    OlympiadYears: [],
                    CompetitionPaths: [],
                    ProblemNumbers: [],
                    TagSlugs: [],
                    TagLogic: LogicToggle.Or,
                    AuthorSlugs: [],
                    AuthorLogic: LogicToggle.Or
                ),
                PageSize: 10,
                PageNumber: 1,
                FavoritesOnly: false
            ),
            UserId: null,
            Language: Language.SK
        );

        // Act - execute the filter with no criteria
        var initialResult = await service.FilterAsync(initialQuery);

        // Assert - verify we get all problems and all available filter options
        Assert.Equal(7, initialResult.Problems.TotalCount);
        Assert.NotNull(initialResult.UpdatedOptions);
        Assert.Equal(2, initialResult.UpdatedOptions.Seasons.Count);
        Assert.Equal(2, initialResult.UpdatedOptions.Competitions.Count);
        Assert.Equal(3, initialResult.UpdatedOptions.Authors.Count);
        Assert.Equal(3, initialResult.UpdatedOptions.Tags.Count);
    });

    /// <summary>
    /// Verifies that filtering by search text returns only problems containing the specified text.
    /// This test ensures the text search functionality works correctly by searching for a specific
    /// Slovak word that appears in one of our test problems.
    /// </summary>
    [Fact]
    public Task FilterBySearchTextReturnsMatchingProblems() => RunTestAsync(async service =>
    {
        // Arrange - search for "štvorstena" (tetrahedron in Slovak) which appears in problem 75-b-i-1
        var textSearchQuery = new ProblemFilterOptions(
            new ProblemFilterQuery(
                new ProblemFilterCriteria(
                    SearchText: "štvorstena",
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
                FavoritesOnly: false
            ),
            UserId: null,
            Language: Language.SK
        );

        // Act - execute the text search
        var textSearchResult = await service.FilterAsync(textSearchQuery);

        // Assert - verify we get exactly one matching problem
        Assert.Single(textSearchResult.Problems.Items);
        Assert.Equal("75-b-i-1", textSearchResult.Problems.Items[0].Slug);
    });

    /// <summary>
    /// Verifies that search is both case-insensitive AND NFD-insensitive (diacritic-insensitive).
    /// This comprehensive test ensures that users can search using various text formats and still
    /// find relevant problems, which is crucial for Slovak text with diacritics.
    /// Tests all combinations:
    /// - lowercase without accents matches text with accents and different case
    /// - uppercase without accents matches text with accents and different case
    /// - mixed case without accents matches text with accents
    /// For example: "stvorstena", "STVORSTENA", "Stvorstena" should all find "štvorstena".
    /// </summary>
    [Fact]
    public Task FilterBySearchTextIsCaseInsensitiveAndAccentInsensitive() => RunTestAsync(async service =>
    {
        // Arrange - test various text normalization scenarios that users might encounter
        // Test 1: lowercase without accents should match "štvorstena" (with accents)
        var lowercaseQuery = new ProblemFilterOptions(
            new ProblemFilterQuery(
                new ProblemFilterCriteria(
                    SearchText: "stvorstena",
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
                FavoritesOnly: false
            ),
            UserId: null,
            Language: Language.SK
        );

        // Test 2: UPPERCASE without accents should match "štvorstena" (lowercase with accents)
        var uppercaseQuery = new ProblemFilterOptions(
            new ProblemFilterQuery(
                new ProblemFilterCriteria(
                    SearchText: "STVORSTENA",
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
                FavoritesOnly: false
            ),
            UserId: null,
            Language: Language.SK
        );

        // Test 3: UPPERCASE without accents should match "Prirodzené" (different case with accents)
        var mixedCaseQuery = new ProblemFilterOptions(
            new ProblemFilterQuery(
                new ProblemFilterCriteria(
                    SearchText: "PRIRODZENE",
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
                FavoritesOnly: false
            ),
            UserId: null,
            Language: Language.SK
        );

        // Test 4: lowercase without accents should match "Prirodzené" (different case with accents)
        var lowerToTitleQuery = new ProblemFilterOptions(
            new ProblemFilterQuery(
                new ProblemFilterCriteria(
                    SearchText: "prirodzene",
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
                FavoritesOnly: false
            ),
            UserId: null,
            Language: Language.SK
        );

        // Act - execute all search variations
        var lowercaseResult = await service.FilterAsync(lowercaseQuery);
        var uppercaseResult = await service.FilterAsync(uppercaseQuery);
        var mixedCaseResult = await service.FilterAsync(mixedCaseQuery);
        var lowerToTitleResult = await service.FilterAsync(lowerToTitleQuery);

        // Assert - all variations should find their respective problems
        // Test 1: lowercase "stvorstena" → "štvorstena"
        Assert.Single(lowercaseResult.Problems.Items);
        Assert.Equal("75-b-i-1", lowercaseResult.Problems.Items[0].Slug);

        // Test 2: UPPERCASE "STVORSTENA" → "štvorstena"
        Assert.Single(uppercaseResult.Problems.Items);
        Assert.Equal("75-b-i-1", uppercaseResult.Problems.Items[0].Slug);

        // Test 3: UPPERCASE "PRIRODZENE" → "Prirodzené"
        Assert.Single(mixedCaseResult.Problems.Items);
        Assert.Equal("75-c-i-1", mixedCaseResult.Problems.Items[0].Slug);

        // Test 4: lowercase "prirodzene" → "Prirodzené"
        Assert.Single(lowerToTitleResult.Problems.Items);
        Assert.Equal("75-c-i-1", lowerToTitleResult.Problems.Items[0].Slug);
    });

    /// <summary>
    /// Guards the coalesce search against the half-populated text columns. Bulk-imported problems store only
    /// <see cref="ProblemText.MarkdownText"/> (legacy <see cref="ProblemText.RawText"/> is null), while the
    /// legacy TeX solutions are the reverse. Search must find both, so it matches
    /// <c>coalesce(markdown_text, raw_text)</c>, not either column alone.
    /// </summary>
    [Fact]
    public async Task FilterBySearchTextFindsMarkdownOnlyAndRawOnlyTexts()
    {
        // Arrange - add a problem whose statement is markdown-only and whose solution is raw-only
        await QueryAsync(async context =>
        {
            // Any seeded round satisfies the foreign key
            var roundId = (await context.Rounds.FirstAsync()).Id;

            // The problem carrying the two half-populated texts
            var problem = new Problem
            {
                Id = Guid.NewGuid(),
                Slug = "coalesce-search-1",
                RoundId = roundId,
                Number = 9
            };

            // Statement stored only as markdown, as the bulk-import pipeline produces
            problem.Texts.Add(new ProblemText
            {
                Id = Guid.NewGuid(),
                ProblemId = problem.Id,
                DocumentType = DocumentType.Statement,
                RawText = null,
                MarkdownText = "Zadanie o markdaunovom mnohouholníku.",
                Language = Language.SK,
                DateModified = DateTime.UtcNow,
                IsOriginal = true
            });

            // Solution stored only as legacy TeX raw text, as the old import pipeline produced
            problem.Texts.Add(new ProblemText
            {
                Id = Guid.NewGuid(),
                ProblemId = problem.Id,
                DocumentType = DocumentType.Solution,
                RawText = "Riešenie využíva rawtextovú indukciu.",
                MarkdownText = null,
                Language = Language.SK,
                DateModified = DateTime.UtcNow,
                IsOriginal = true
            });

            // Commit the problem so the service under test sees it
            context.Problems.Add(problem);
            await context.SaveChangesAsync();
        });

        await RunTestAsync(async service =>
        {
            // A term living only in the markdown statement, spelled without accents
            var statementQuery = new ProblemFilterOptions(
                new ProblemFilterQuery(
                    new ProblemFilterCriteria(
                        SearchText: "markdaunovom",
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
                    FavoritesOnly: false),
                UserId: null,
                Language: Language.SK);

            // A term living only in the raw-text solution, with solution search enabled
            var solutionQuery = new ProblemFilterOptions(
                new ProblemFilterQuery(
                    new ProblemFilterCriteria(
                        SearchText: "rawtextovu",
                        SearchInSolution: true,
                        OlympiadYears: [],
                        CompetitionPaths: [],
                        ProblemNumbers: [],
                        TagSlugs: [],
                        TagLogic: LogicToggle.Or,
                        AuthorSlugs: [],
                        AuthorLogic: LogicToggle.Or),
                    PageSize: 10,
                    PageNumber: 1,
                    FavoritesOnly: false),
                UserId: null,
                Language: Language.SK);

            // Act - run both searches
            var statementResult = await service.FilterAsync(statementQuery);
            var solutionResult = await service.FilterAsync(solutionQuery);

            // Assert - the markdown-only statement is found
            Assert.Contains(statementResult.Problems.Items, problem => problem.Slug == "coalesce-search-1");

            // Assert - the raw-only solution is found
            Assert.Contains(solutionResult.Problems.Items, problem => problem.Slug == "coalesce-search-1");
        });
    }

    /// <summary>
    /// Verifies that filtering by a single author returns all problems authored by that person.
    /// This test ensures the author filtering functionality works correctly and returns the
    /// expected number of problems for a specific author in our test dataset.
    /// </summary>
    [Fact]
    public Task FilterBySingleAuthorReturnsCorrectProblems() => RunTestAsync(async service =>
    {
        // Arrange - filter by Patrik Bak, who authored 5 problems in our test data
        var authorQuery = new ProblemFilterOptions(
            new ProblemFilterQuery(
                new ProblemFilterCriteria(
                    SearchText: string.Empty,
                    SearchInSolution: false,
                    OlympiadYears: [],
                    CompetitionPaths: [],
                    ProblemNumbers: [],
                    TagSlugs: [],
                    TagLogic: LogicToggle.Or,
                    AuthorSlugs: ["patrik-bak"],
                    AuthorLogic: LogicToggle.Or),
                PageSize: 10,
                PageNumber: 1,
                FavoritesOnly: false
            ),
            UserId: null,
            Language: Language.SK
        );

        // Act - execute the author filter
        var authorResult = await service.FilterAsync(authorQuery);

        // Assert - verify we get all 5 problems by Patrik Bak
        Assert.Equal(5, authorResult.Problems.TotalCount);
        Assert.All(authorResult.Problems.Items, problem => Assert.Contains(problem.Authors, author => author.DisplayName == "Patrik Bak"));
    });

    /// <summary>
    /// Verifies that filtering by multiple tags with OR logic returns problems that have any of the selected tags.
    /// This test ensures that when users select multiple tags with OR logic, they get problems
    /// that match any of the selected tags, not necessarily all of them.
    /// </summary>
    [Fact]
    public Task FilterByMultipleTagsWithOrLogicReturnsCorrectProblems() => RunTestAsync(async service =>
    {
        // Arrange - filter by algebra OR number-theory tags (should return 2 problems)
        var tagsOrQuery = new ProblemFilterOptions(
            new ProblemFilterQuery(
                new ProblemFilterCriteria(
                    SearchText: string.Empty,
                    SearchInSolution: false,
                    OlympiadYears: [],
                    CompetitionPaths: [],
                    ProblemNumbers: [],
                    TagSlugs: ["algebra", "number-theory"],
                    TagLogic: LogicToggle.Or,
                    AuthorSlugs: [],
                    AuthorLogic: LogicToggle.Or),
                PageSize: 10,
                PageNumber: 1,
                FavoritesOnly: false
            ),
            UserId: null,
            Language: Language.SK
        );

        // Act - execute the OR tag filter
        var tagsOrResult = await service.FilterAsync(tagsOrQuery);

        // Assert - verify we get problems with either algebra OR number-theory tags
        Assert.Equal(2, tagsOrResult.Problems.TotalCount);
    });

    /// <summary>
    /// Verifies that filtering by multiple tags with AND logic returns problems that have all of the selected tags.
    /// This test uses tags that don't overlap in our test data to ensure the AND logic works correctly
    /// by returning no results when no problems have all the specified tags.
    /// </summary>
    [Fact]
    public Task FilterByMultipleTagsWithAndLogicReturnsNoProblemsWhenNoneMatchAll() => RunTestAsync(async service =>
    {
        // Arrange - filter by algebra AND number-theory tags (no problems have both in our test data)
        var tagsAndQuery = new ProblemFilterOptions(
            new ProblemFilterQuery(
                new ProblemFilterCriteria(
                    SearchText: string.Empty,
                    SearchInSolution: false,
                    OlympiadYears: [],
                    CompetitionPaths: [],
                    ProblemNumbers: [],
                    TagSlugs: ["algebra", "number-theory"],
                    TagLogic: LogicToggle.And,
                    AuthorSlugs: [],
                    AuthorLogic: LogicToggle.Or),
                PageSize: 10,
                PageNumber: 1,
                FavoritesOnly: false
            ),
            UserId: null,
            Language: Language.SK
        );

        // Act - execute the AND tag filter
        var tagsAndResult = await service.FilterAsync(tagsAndQuery);

        // Assert - verify we get no results since no problems have both tags
        Assert.Empty(tagsAndResult.Problems.Items);
    });

    /// <summary>
    /// Verifies that a complex filter with multiple criteria (Season, Category, and Tag) returns the correct subset of problems.
    /// This test ensures that when multiple filter criteria are applied simultaneously, the service
    /// correctly combines them using AND logic to return only problems that match all criteria.
    /// </summary>
    [Fact]
    public Task FilterWithComplexQueryReturnsCorrectProblems() => RunTestAsync(async service =>
    {
        // Arrange - filter by season 75 AND geometry tag (should return 2 problems)
        var complexQuery = new ProblemFilterOptions(
            new ProblemFilterQuery(
                new ProblemFilterCriteria(
                    SearchText: string.Empty,
                    SearchInSolution: false,
                    OlympiadYears: [75],
                    CompetitionPaths: [],
                    ProblemNumbers: [],
                    TagSlugs: ["geometry"],
                    TagLogic: LogicToggle.Or,
                    AuthorSlugs: [],
                    AuthorLogic: LogicToggle.Or),
                PageSize: 10,
                PageNumber: 1,
                FavoritesOnly: false
            ),
            UserId: null,
            Language: Language.SK
        );

        // Act - execute the complex multi-criteria filter
        var complexQueryResult = await service.FilterAsync(complexQuery);

        // Assert - verify we get exactly 2 problems that match both season 75 and geometry tag
        Assert.Equal(2, complexQueryResult.Problems.Items.Count);
        foreach (var problem in complexQueryResult.Problems.Items)
        {
            Assert.Equal("75", problem.Source.Season.Slug);
            Assert.Contains(problem.Tags, tag => tag.Slug == "geometry");
        }
    });

    /// <summary>
    /// Verifies that pagination works correctly, returning the correct number of items for each page.
    /// This test ensures that when results are split across multiple pages, each page contains
    /// the expected number of items and the total count remains consistent across pages.
    /// </summary>
    [Fact]
    public Task FilterWithPaginationReturnsCorrectPages() => RunTestAsync(async service =>
    {
        // Arrange - create queries for page 1 (4 items) and page 2 (remaining items)
        var page1Query = new ProblemFilterOptions(
            new ProblemFilterQuery(
                new ProblemFilterCriteria(
                    SearchText: string.Empty,
                    SearchInSolution: false,
                    OlympiadYears: [],
                    CompetitionPaths: [],
                    ProblemNumbers: [],
                    TagSlugs: [],
                    TagLogic: LogicToggle.Or,
                    AuthorSlugs: [],
                    AuthorLogic: LogicToggle.Or),
                PageSize: 4,
                PageNumber: 1,
                FavoritesOnly: false
            ),
            UserId: null,
            Language: Language.SK
        );
        var page2Query = new ProblemFilterOptions(
            new ProblemFilterQuery(
                new ProblemFilterCriteria(
                    SearchText: string.Empty,
                    SearchInSolution: false,
                    OlympiadYears: [],
                    CompetitionPaths: [],
                    ProblemNumbers: [],
                    TagSlugs: [],
                    TagLogic: LogicToggle.Or,
                    AuthorSlugs: [],
                    AuthorLogic: LogicToggle.Or),
                PageSize: 4,
                PageNumber: 2,
                FavoritesOnly: false
            ),
            UserId: null,
            Language: Language.SK
        );

        // Act - execute both page queries
        var page1Result = await service.FilterAsync(page1Query);
        var page2Result = await service.FilterAsync(page2Query);

        // Assert - verify pagination works correctly with 7 total problems
        Assert.Equal(4, page1Result.Problems.Items.Count);
        Assert.Equal(7, page1Result.Problems.TotalCount);
        Assert.Equal(3, page2Result.Problems.Items.Count);
        Assert.Equal(7, page2Result.Problems.TotalCount);
    });

    /// <summary>
    /// Verifies that a query with criteria that should not match any problems returns an empty result set.
    /// This test ensures the service handles edge cases gracefully and returns appropriate empty results
    /// when no problems match the specified criteria, rather than throwing exceptions.
    /// </summary>
    [Fact]
    public Task FilterWithNoMatchingCriteriaReturnsEmptyResult() => RunTestAsync(async service =>
    {
        // Arrange - search for text that doesn't exist in any problem statement
        var noResultsQuery = new ProblemFilterOptions(
            new ProblemFilterQuery(
                new ProblemFilterCriteria(
                    SearchText: "non_existent_text_gibrish",
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
                FavoritesOnly: false
            ),
            UserId: null,
            Language: Language.SK
        );

        // Act - execute the query that should return no results
        var noResultsResult = await service.FilterAsync(noResultsQuery);

        // Assert - verify we get an empty result set with zero total count
        Assert.Empty(noResultsResult.Problems.Items);
        Assert.Equal(0, noResultsResult.Problems.TotalCount);
    });
    /// <summary>
    /// Verifies that filtering returns correct like information (Liked status and LikeCount).
    /// This test ensures that:
    /// 1. LikeCount accurately reflects the total number of likes.
    /// 2. Liked is true for problems liked by the requesting user.
    /// 3. Liked is false for problems not liked by the requesting user.
    /// 4. Liked is false when no user is provided (anonymous access).
    /// </summary>
    [Fact]
    public Task FilterReturnsCorrectLikeInformation() => RunTestAsync(async service =>
    {
        // Arrange - Use seeded users
        var user1Id = Guid.Parse("00000000-0000-0000-0000-000000000001");
        var user2Id = Guid.Parse("00000000-0000-0000-0000-000000000002");

        // Act 1: Query as User 1
        var baseQuery = new ProblemFilterOptions(
            new ProblemFilterQuery(
                new ProblemFilterCriteria(
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
                FavoritesOnly: false
            ),
            UserId: null,
            Language: Language.SK
        );
        var resultUser1 = await service.FilterAsync(baseQuery with { UserId = user1Id });

        // Act 2: Query as User 2
        var resultUser2 = await service.FilterAsync(baseQuery with { UserId = user2Id });

        // Act 3: Query as Anonymous
        var resultAnon = await service.FilterAsync(baseQuery);

        // Assert 1: User 1
        var p1User1 = resultUser1.Problems.Items.First(problem => problem.Slug == "75-a-i-1");
        var p2User1 = resultUser1.Problems.Items.First(problem => problem.Slug == "75-b-i-1");
        var p3User1 = resultUser1.Problems.Items.First(problem => problem.Slug == "75-c-i-1");

        Assert.True(p1User1.Liked);
        Assert.Equal(1, p1User1.LikeCount);

        Assert.True(p2User1.Liked);
        Assert.Equal(2, p2User1.LikeCount);

        Assert.False(p3User1.Liked);
        Assert.Equal(0, p3User1.LikeCount);

        // Assert 2: User 2
        var p1User2 = resultUser2.Problems.Items.First(problem => problem.Slug == "75-a-i-1");
        var p2User2 = resultUser2.Problems.Items.First(problem => problem.Slug == "75-b-i-1");

        Assert.False(p1User2.Liked); // Liked by user1, not user2
        Assert.Equal(1, p1User2.LikeCount);

        Assert.True(p2User2.Liked); // Liked by both
        Assert.Equal(2, p2User2.LikeCount);

        // Assert 3: Anonymous
        var p1Anon = resultAnon.Problems.Items.First(problem => problem.Slug == "75-a-i-1");
        var p2Anon = resultAnon.Problems.Items.First(problem => problem.Slug == "75-b-i-1");

        Assert.False(p1Anon.Liked);
        Assert.Equal(1, p1Anon.LikeCount);

        Assert.False(p2Anon.Liked);
        Assert.Equal(2, p2Anon.LikeCount);
    });

    /// <summary>
    /// Verifies that filtering with FavoritesOnly returns only problems liked by the requesting user.
    /// This test ensures that:
    /// 1. When FavoritesOnly is true and a user is provided, only problems liked by that user are returned.
    /// 2. When FavoritesOnly is false, all problems are returned regardless of like status.
    /// 3. When FavoritesOnly is true but no user is provided, no problems are returned (anonymous users have no favorites).
    /// </summary>
    [Fact]
    public Task FilterWithFavoritesOnlyReturnsOnlyLikedProblems() => RunTestAsync(async service =>
    {
        // Arrange - Use seeded users
        var user1Id = Guid.Parse("00000000-0000-0000-0000-000000000001");
        var user2Id = Guid.Parse("00000000-0000-0000-0000-000000000002");

        // Create base query with FavoritesOnly = true
        var favoritesQuery = new ProblemFilterOptions(
            new ProblemFilterQuery(
                new ProblemFilterCriteria(
                    SearchText: string.Empty,
                    SearchInSolution: false,
                    OlympiadYears: [],
                    CompetitionPaths: [],
                    ProblemNumbers: [],
                    TagSlugs: [],
                    TagLogic: LogicToggle.Or,
                    AuthorSlugs: [],
                    AuthorLogic: LogicToggle.Or
                ),
                PageSize: 10,
                PageNumber: 1,
                FavoritesOnly: true
            ),
            UserId: null,
            Language: Language.SK
        );

        // Act 1: Query favorites for User 1 (liked 75-a-i-1 and 75-b-i-1)
        var resultUser1Favorites = await service.FilterAsync(favoritesQuery with { UserId = user1Id });

        // Act 2: Query favorites for User 2 (liked only 75-b-i-1)
        var resultUser2Favorites = await service.FilterAsync(favoritesQuery with { UserId = user2Id });

        // Act 3: Query favorites for Anonymous (should throw)
        await Assert.ThrowsAsync<FavoritesRequireAuthenticationException>(() => service.FilterAsync(favoritesQuery));

        // Act 4: Query all problems for User 1 (FavoritesOnly = false)
        var allProblemsQuery = favoritesQuery with { Query = favoritesQuery.Query with { FavoritesOnly = false } };
        var resultUser1All = await service.FilterAsync(allProblemsQuery with { UserId = user1Id });

        // Assert 1: User 1 favorites - should get 2 problems (75-a-i-1 and 75-b-i-1)
        Assert.Equal(2, resultUser1Favorites.Problems.TotalCount);
        Assert.Contains(resultUser1Favorites.Problems.Items, p => p.Slug == "75-a-i-1");
        Assert.Contains(resultUser1Favorites.Problems.Items, p => p.Slug == "75-b-i-1");
        Assert.All(resultUser1Favorites.Problems.Items, p => Assert.True(p.Liked));

        // Assert 2: User 2 favorites - should get 1 problem (75-b-i-1)
        Assert.Single(resultUser2Favorites.Problems.Items);
        Assert.Equal("75-b-i-1", resultUser2Favorites.Problems.Items[0].Slug);
        Assert.True(resultUser2Favorites.Problems.Items[0].Liked);

        // Assert 3: User 1 all problems - should get all 7 problems
        Assert.Equal(7, resultUser1All.Problems.TotalCount);
    });

    /// <summary>
    /// Verifies that filtering returns correct comment counts.
    /// This test ensures that:
    /// 1. CommentCount accurately reflects the total number of comments for a problem.
    /// 2. Problems with no comments return 0.
    /// </summary>
    [Fact]
    public Task FilterReturnsCorrectCommentCount() => RunTestAsync(async service =>
    {
        // Arrange
        var baseQuery = new ProblemFilterOptions(
            new ProblemFilterQuery(
                new ProblemFilterCriteria(
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
                FavoritesOnly: false
            ),
            UserId: null,
            Language: Language.SK
        );

        // Act
        var result = await service.FilterAsync(baseQuery);

        // Assert
        var p1 = result.Problems.Items.First(problem => problem.Slug == "75-a-i-1");
        var p2 = result.Problems.Items.First(problem => problem.Slug == "75-b-i-1");
        var p3 = result.Problems.Items.First(problem => problem.Slug == "75-c-i-1");

        // p1 has 1 active + 1 superseded => count should be 1
        Assert.Equal(1, p1.CommentCount);
        Assert.Equal(2, p2.CommentCount);
        Assert.Equal(0, p3.CommentCount);
    });

    /// <summary>
    /// Verifies that the season facet options returned by FilterAsync have correct labels.
    /// This test ensures the season labels display full calendar years (e.g., "75. ročník (2025/2026)")
    /// rather than abbreviated or incorrect year formats.
    /// </summary>
    [Fact]
    public Task FilterReturnsCorrectSeasonLabels() => RunTestAsync(async service =>
    {
        // Arrange - create a query with no filters to get all season options
        var query = new ProblemFilterOptions(
            new ProblemFilterQuery(
                new ProblemFilterCriteria(
                    SearchText: string.Empty,
                    SearchInSolution: false,
                    OlympiadYears: [],
                    CompetitionPaths: [],
                    ProblemNumbers: [],
                    TagSlugs: [],
                    TagLogic: LogicToggle.Or,
                    AuthorSlugs: [],
                    AuthorLogic: LogicToggle.Or
                ),
                PageSize: 10,
                PageNumber: 1,
                FavoritesOnly: false
            ),
            UserId: null,
            Language: Language.SK
        );

        // Act
        var result = await service.FilterAsync(query);

        // Assert - verify season labels have correct format with full calendar years
        Assert.NotNull(result.UpdatedOptions);
        Assert.Equal(2, result.UpdatedOptions.Seasons.Count);

        // Seasons should be ordered descending (newest first)
        var season75 = result.UpdatedOptions.Seasons.First(season => season.Slug == "75");
        var season74 = result.UpdatedOptions.Seasons.First(season => season.Slug == "74");

        // Verify the labels contain full 4-digit years (2025/2026 and 2024/2025)
        Assert.Equal("75. ročník (2025/2026)", season75.DisplayName);
        Assert.Equal("74. ročník (2024/2025)", season74.DisplayName);
    });

    #region Competition Tree Tests

    /// <summary>
    /// Verifies that the competition facets also come back as the tree they actually form: every competition
    /// holding problems and every competition above it, each addressed by its own path, ordered as the registry
    /// places it among its siblings, and carrying what its whole subtree holds rather than only what hangs off
    /// it directly.
    /// </summary>
    [Fact]
    public Task FilterOffersTheCompetitionsAsTheTreeTheyForm() => RunTestAsync(async service =>
    {
        // Arrange - ask for everything, so every seeded competition reaches the facets
        var everythingQuery = new ProblemFilterOptions(
            new ProblemFilterQuery(
                new ProblemFilterCriteria(
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
                FavoritesOnly: false
            ),
            UserId: null,
            Language: Language.SK
        );

        // Act
        var result = await service.FilterAsync(everythingQuery);

        // The competitions as the tree they form
        var competitions = result.UpdatedOptions!.Competitions;

        // Assert - the competitions, in the order their sort orders place them
        Assert.Equal(["csmo", "imo"], competitions.Select(competition => competition.Path));

        // The CSMO branch
        var csmo = competitions[0];

        // Assert - it totals every problem under it, six across its four categories
        Assert.Equal(6, csmo.Count);

        // Assert - and it is named at its own path
        Assert.Equal("CSMO", csmo.DisplayName);
        Assert.Equal("Česko-slovenská Matematická olympiáda", csmo.FullName);

        // Assert - its categories, each addressed by its own path
        Assert.Equal(["csmo-a", "csmo-b", "csmo-c", "csmo-z9"], csmo.Children.Select(child => child.Path));

        // Assert - each totalling its own rounds
        Assert.Equal([2, 1, 1, 2], csmo.Children.Select(child => child.Count));

        // The Z9 category, the one seeded with two rounds
        var z9 = csmo.Children.Single(child => child.Path == "csmo-z9");

        // Assert - its rounds, which are the level the problems it totalled actually hang off
        Assert.Equal(["csmo-z9-i", "csmo-z9-iii"], z9.Children.Select(child => child.Path));
        Assert.Equal([1, 1], z9.Children.Select(child => child.Count));

        // Assert - and they carry their own localized names
        Assert.Equal(["Domáce kolo", "Krajské kolo"], z9.Children.Select(child => child.DisplayName));

        // Assert - a round has nothing below it
        Assert.Empty(z9.Children[0].Children);

        // A competition running as one flat sitting, which stands for itself and offers nothing under it
        var imo = competitions[1];

        // Assert - it carries its own problem and no children
        Assert.Equal(1, imo.Count);
        Assert.Empty(imo.Children);
    });

    /// <summary>
    /// Verifies that a selection stands for its whole subtree: naming a branch matches everything under it,
    /// while naming a competition that holds problems itself matches exactly those.
    /// </summary>
    [Fact]
    public Task FilterFoldsACompetitionSelectionOverItsWholeSubtree() => RunTestAsync(async service =>
    {
        // The slugs of everything one path matches, ordered so the comparisons read as sets rather than pages
        async Task<string[]> MatchedSlugsAsync(string path)
        {
            // Filter by that one selection alone, leaving every other facet open
            var result = await service.FilterAsync(new ProblemFilterOptions(
                new ProblemFilterQuery(
                    new ProblemFilterCriteria(
                        SearchText: string.Empty,
                        SearchInSolution: false,
                        OlympiadYears: [],
                        CompetitionPaths: [path],
                        ProblemNumbers: [],
                        TagSlugs: [],
                        TagLogic: LogicToggle.Or,
                        AuthorSlugs: [],
                        AuthorLogic: LogicToggle.Or),
                    PageSize: 10,
                    PageNumber: 1,
                    FavoritesOnly: false
                ),
                UserId: null,
                Language: Language.SK
            ));

            return [.. result.Problems.Items.Select(problem => problem.Slug).Order()];
        }

        // Assert - a leaf holding problems matches exactly those
        Assert.Equal(["75-a-i-1", "75-a-i-2"], await MatchedSlugsAsync("csmo-a-i"));

        // Assert - the category above it stands for the same, since the home round is all it holds
        Assert.Equal(["75-a-i-1", "75-a-i-2"], await MatchedSlugsAsync("csmo-a"));

        // Assert - and the competition folds in every category under it, across seasons
        Assert.Equal(
            ["74-z9-i-1", "74-z9-iii-1", "75-a-i-1", "75-a-i-2", "75-b-i-1", "75-c-i-1"],
            await MatchedSlugsAsync("csmo"));

        // Assert - a path naming no competition matches nothing rather than falling back to a prefix of it
        Assert.Empty(await MatchedSlugsAsync("csmo-a-i-nope"));
    });

    /// <summary>
    /// Verifies that a problem names every competition down to the one it was set in, root-first, each entry
    /// addressed by its full path — including a competition running as one flat sitting, whose chain is the
    /// competition alone.
    /// </summary>
    [Fact]
    public Task FilterNamesEveryCompetitionDownToTheProblemsOwn() => RunTestAsync(async service =>
    {
        // Arrange - ask for everything, so both a categorised problem and a flat-sitting one come back
        var everythingQuery = new ProblemFilterOptions(
            new ProblemFilterQuery(
                new ProblemFilterCriteria(
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
                FavoritesOnly: false
            ),
            UserId: null,
            Language: Language.SK
        );

        // Act
        var result = await service.FilterAsync(everythingQuery);

        // The CSMO problem, set three levels down in the home round of category A
        var csmoProblem = result.Problems.Items.Single(problem => problem.Slug == "75-a-i-1");

        // Assert - it names all three, each entry addressed by its whole path rather than its own segment
        Assert.Equal(["csmo", "csmo-a", "csmo-a-i"],
            csmoProblem.Source.Competition.Select(competition => competition.Slug));

        // Assert - and each carries the names it reads under
        Assert.Equal(["CSMO", "A", "Domáce kolo"],
            csmoProblem.Source.Competition.Select(competition => competition.DisplayName));
        Assert.Equal("Kategória A", csmoProblem.Source.Competition[1].FullName);

        // The IMO problem, whose competition runs as one flat sitting
        var imoProblem = result.Problems.Items.Single(problem => problem.Slug == "imo-2025-1");

        // Assert - its chain is that competition and nothing else
        Assert.Equal(["imo"], imoProblem.Source.Competition.Select(competition => competition.Slug));
    });

    #endregion

    #region GetCompetitionsBySeasonAsync Tests

    /// <summary>
    /// Verifies that both seeded seasons come back, ordered by edition number descending (newest first).
    /// This ensures the UI displays the most recent seasons at the top.
    /// </summary>
    [Fact]
    public Task GetCompetitionsBySeasonReturnsSeasonsInDescendingOrder() => RunTestAsync(async service =>
    {
        // Act
        var result = await service.GetCompetitionsBySeasonAsync(Language.SK);

        // Assert - both seeded seasons come back
        Assert.Equal(2, result.Seasons.Count);

        // Assert - newest season (75) should come first
        Assert.Equal(75, result.Seasons[0].EditionNumber);
        Assert.Equal(74, result.Seasons[1].EditionNumber);
        Assert.Equal("75. ročník (2025/2026)", result.Seasons[0].EditionLabel);
        Assert.Equal("74. ročník (2024/2025)", result.Seasons[1].EditionLabel);
    });

    /// <summary>
    /// Verifies that a season offers every competition its problems were set in and nothing else, each named by its
    /// own path — the three CSMO categories' home rounds and the IMO sitting.
    /// </summary>
    [Fact]
    public Task GetCompetitionsBySeasonReturnsCompetitionsForEachSeason() => RunTestAsync(async service =>
    {
        // Act
        var result = await service.GetCompetitionsBySeasonAsync(Language.SK);

        // The newest season
        var season75 = result.Seasons.First(season => season.EditionNumber == 75);

        // Assert - exactly the competitions holding its problems, ordered down the tree
        Assert.Equal(
            ["csmo-a-i", "csmo-b-i", "csmo-c-i", "imo"],
            season75.Competitions.Select(competition => competition.Path));
    });

    /// <summary>
    /// Verifies that problem counts are correct for each competition.
    /// This ensures the UI can display accurate problem counts next to each competition.
    /// </summary>
    [Fact]
    public Task GetCompetitionsBySeasonReturnsProblemCounts() => RunTestAsync(async service =>
    {
        // Act
        var result = await service.GetCompetitionsBySeasonAsync(Language.SK);

        // Assert - check specific competition counts
        var season75 = result.Seasons.First(s => s.EditionNumber == 75);

        // CSMO A in season 75 has 2 problems (p1, p4)
        var csmoA = season75.Competitions.First(competition => competition.Path == "csmo-a-i");
        Assert.Equal(2, csmoA.ProblemCount);

        // CSMO B in season 75 has 1 problem (p2)
        var csmoB = season75.Competitions.First(competition => competition.Path == "csmo-b-i");
        Assert.Equal(1, csmoB.ProblemCount);

        // CSMO C in season 75 has 1 problem (p3)
        var csmoC = season75.Competitions.First(competition => competition.Path == "csmo-c-i");
        Assert.Equal(1, csmoC.ProblemCount);

        // IMO in season 75 has 1 problem (p7)
        var imo = season75.Competitions.First(competition => competition.Path == "imo");
        Assert.Equal(1, imo.ProblemCount);
    });

    /// <summary>
    /// Verifies that season 74 contains its own distinct competitions.
    /// Tests data isolation between seasons.
    /// </summary>
    [Fact]
    public Task GetCompetitionsBySeasonIsolatesCompetitionsBySeason() => RunTestAsync(async service =>
    {
        // Act
        var result = await service.GetCompetitionsBySeasonAsync(Language.SK);

        // Assert - season 74 has different competitions than season 75
        var season74 = result.Seasons.First(season => season.EditionNumber == 74);

        // Season 74 should have 2 competitions (Z9 domestic and Z9 regional)
        Assert.Equal(2, season74.Competitions.Count);

        // Both should sit under the Z9 category
        Assert.All(season74.Competitions,
            competition => Assert.True(TaxonomySlugs.IsAtOrUnder(competition.Path, "csmo-z9")));
    });

    /// <summary>
    /// Verifies that each browsed competition reads as the chain of display names down to it, including a
    /// competition running as one flat sitting, whose chain is a single label.
    /// </summary>
    [Fact]
    public Task GetCompetitionsBySeasonNamesEachCompetitionByItsChain() => RunTestAsync(async service =>
    {
        // Act
        var result = await service.GetCompetitionsBySeasonAsync(Language.SK);

        // The newest season, which holds both a three-level competition and a flat one
        var season75 = result.Seasons.First(season => season.EditionNumber == 75);

        // The home round of category A, which sits three levels down
        var csmoA = season75.Competitions.First(competition => competition.Path == "csmo-a-i");

        // Assert - the labels read down to it
        Assert.Equal(["CSMO", "A", "Domáce kolo"], csmoA.Labels);

        // The IMO sitting, which is its own competition
        var imo = season75.Competitions.First(competition => competition.Path == "imo");

        // Assert - a one-level competition reads as one label
        Assert.Equal(["IMO"], imo.Labels);
    });

    #endregion

    #region Language-Aware Statement Selection Tests

    /// <summary>
    /// Verifies that requesting the original language returns the original statement.
    /// Problem 75-a-i-1 has Slovak as original, requesting Slovak should return Slovak.
    /// </summary>
    [Fact]
    public Task FilterReturnsOriginalStatementWhenRequestingOriginalLanguage() => RunTestAsync(async service =>
    {
        // Arrange - query for Slovak (original language for most CSMO problems)
        var query = new ProblemFilterOptions(
            new ProblemFilterQuery(
                new ProblemFilterCriteria(
                    SearchText: "Ostrov",  // Unique text in 75-a-i-1
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
                FavoritesOnly: false
            ),
            UserId: null,
            Language: Language.SK
        );

        // Act
        var result = await service.FilterAsync(query);

        // Assert - should return Slovak statement
        Assert.Single(result.Problems.Items);
        var problem = result.Problems.Items[0];
        Assert.Equal("75-a-i-1", problem.Slug);
        Assert.Equal("Ostrov je rozdelený na niekoľko kráľovstiev.", problem.StatementMarkdown);
    });

    /// <summary>
    /// Verifies that requesting a non-original language returns the translation when it exists.
    /// Problem 75-a-i-1 has both Slovak (original) and English translation, requesting English should return English.
    /// </summary>
    [Fact]
    public Task FilterReturnsTranslatedStatementWhenTranslationExists() => RunTestAsync(async service =>
    {
        // Arrange - query for English (translation exists for 75-a-i-1)
        var query = new ProblemFilterOptions(
            new ProblemFilterQuery(
                new ProblemFilterCriteria(
                    SearchText: string.Empty,
                    SearchInSolution: false,
                    OlympiadYears: [75],
                    CompetitionPaths: ["csmo-a-i"],
                    ProblemNumbers: [1],
                    TagSlugs: [],
                    TagLogic: LogicToggle.Or,
                    AuthorSlugs: [],
                    AuthorLogic: LogicToggle.Or),
                PageSize: 10,
                PageNumber: 1,
                FavoritesOnly: false
            ),
            UserId: null,
            Language: Language.EN
        );

        // Act
        var result = await service.FilterAsync(query);

        // Assert - should return English translation
        Assert.Single(result.Problems.Items);
        var problem = result.Problems.Items[0];
        Assert.Equal("75-a-i-1", problem.Slug);
        Assert.Equal("The island is divided into several kingdoms.", problem.StatementMarkdown);
    });

    /// <summary>
    /// Verifies that requesting a non-original language falls back to original when translation doesn't exist.
    /// Problem 75-b-i-1 has only Slovak (original), requesting English should fall back to Slovak.
    /// </summary>
    [Fact]
    public Task FilterFallsBackToOriginalWhenTranslationDoesNotExist() => RunTestAsync(async service =>
    {
        // Arrange - query for English (no translation exists for 75-b-i-1)
        var query = new ProblemFilterOptions(
            new ProblemFilterQuery(
                new ProblemFilterCriteria(
                    SearchText: string.Empty,
                    SearchInSolution: false,
                    OlympiadYears: [75],
                    CompetitionPaths: ["csmo-b-i"],
                    ProblemNumbers: [1],
                    TagSlugs: [],
                    TagLogic: LogicToggle.Or,
                    AuthorSlugs: [],
                    AuthorLogic: LogicToggle.Or),
                PageSize: 10,
                PageNumber: 1,
                FavoritesOnly: false
            ),
            UserId: null,
            Language: Language.EN
        );

        // Act
        var result = await service.FilterAsync(query);

        // Assert - should fall back to Slovak (original) since no English translation exists
        Assert.Single(result.Problems.Items);
        var problem = result.Problems.Items[0];
        Assert.Equal("75-b-i-1", problem.Slug);
        Assert.Equal("Každej hrane štvorstena priradíme jedno reálne číslo.", problem.StatementMarkdown);
    });

    #endregion

    #region ListContentId Filtering Tests

    /// <summary>
    /// Verifies that filtering by ListContentId returns only problems in the specified list.
    /// </summary>
    [Fact]
    public Task FilterByListContentIdReturnsOnlyListMembers() => RunTestAsync(async service =>
    {
        // Arrange — user1 has a list with p1 and p2 seeded
        var user1Id = Guid.Parse("00000000-0000-0000-0000-000000000001");

        var query = new ProblemFilterOptions(
            new ProblemFilterQuery(
                new ProblemFilterCriteria(
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
                ListContentId: "test-list-1"
            ),
            UserId: user1Id,
            Language: Language.SK
        );

        // Act
        var result = await service.FilterAsync(query);

        // Assert — only p1 and p2 are in the list
        Assert.Equal(2, result.Problems.TotalCount);
        Assert.Contains(result.Problems.Items, p => p.Slug == "75-a-i-1");
        Assert.Contains(result.Problems.Items, p => p.Slug == "75-b-i-1");
    });

    /// <summary>
    /// Verifies that filtering by a list with no problems returns empty results.
    /// </summary>
    [Fact]
    public Task FilterByEmptyListReturnsNoProblems() => RunTestAsync(async service =>
    {
        // Arrange — user2 has an empty list
        var user2Id = Guid.Parse("00000000-0000-0000-0000-000000000002");

        var query = new ProblemFilterOptions(
            new ProblemFilterQuery(
                new ProblemFilterCriteria(
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
                ListContentId: "test-list-empty"
            ),
            UserId: user2Id,
            Language: Language.SK
        );

        // Act
        var result = await service.FilterAsync(query);

        // Assert
        Assert.Empty(result.Problems.Items);
        Assert.Equal(0, result.Problems.TotalCount);
    });

    /// <summary>
    /// Verifies that list filtering composes with other filters (e.g., tags).
    /// Only problems matching both list membership AND the tag filter should be returned.
    /// </summary>
    [Fact]
    public Task FilterByListContentIdComposesWithTagFilter() => RunTestAsync(async service =>
    {
        // Arrange — user1's list has p1 (geometry) and p2 (algebra). Filter by geometry tag.
        var user1Id = Guid.Parse("00000000-0000-0000-0000-000000000001");

        var query = new ProblemFilterOptions(
            new ProblemFilterQuery(
                new ProblemFilterCriteria(
                    SearchText: string.Empty,
                    SearchInSolution: false,
                    OlympiadYears: [],
                    CompetitionPaths: [],
                    ProblemNumbers: [],
                    TagSlugs: ["geometry"],
                    TagLogic: LogicToggle.Or,
                    AuthorSlugs: [],
                    AuthorLogic: LogicToggle.Or),
                PageSize: 10,
                PageNumber: 1,
                FavoritesOnly: false,
                ListContentId: "test-list-1"
            ),
            UserId: user1Id,
            Language: Language.SK
        );

        // Act
        var result = await service.FilterAsync(query);

        // Assert — only p1 has the geometry tag in the list
        Assert.Single(result.Problems.Items);
        Assert.Equal("75-a-i-1", result.Problems.Items[0].Slug);
    });

    #endregion

    #region ListContentIds Projection Tests

    /// <summary>
    /// Verifies that ListContentIds correctly reflects which lists contain each problem for the requesting user.
    /// - p1 is in 1 list ("test-list-1")
    /// - p2 is in 2 lists ("test-list-1" and "test-list-2")
    /// - p3 is in 0 lists
    /// </summary>
    [Fact]
    public Task FilterReturnsCorrectListContentIds() => RunTestAsync(async service =>
    {
        // Arrange
        var user1Id = Guid.Parse("00000000-0000-0000-0000-000000000001");

        var query = new ProblemFilterOptions(
            new ProblemFilterQuery(
                new ProblemFilterCriteria(
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
                FavoritesOnly: false
            ),
            UserId: user1Id,
            Language: Language.SK
        );

        // Act
        var result = await service.FilterAsync(query);

        // Assert
        var p1 = result.Problems.Items.First(p => p.Slug == "75-a-i-1");
        var p2 = result.Problems.Items.First(p => p.Slug == "75-b-i-1");
        var p3 = result.Problems.Items.First(p => p.Slug == "75-c-i-1");

        // p1 is in list1 only
        Assert.Single(p1.ListContentIds);
        Assert.Contains("test-list-1", p1.ListContentIds);

        // p2 is in list1 and list2
        Assert.Equal(2, p2.ListContentIds.Count);
        Assert.Contains("test-list-1", p2.ListContentIds);
        Assert.Contains("test-list-2", p2.ListContentIds);

        // p3 is not in any list
        Assert.Empty(p3.ListContentIds);
    });

    /// <summary>
    /// Verifies that ListContentIds is empty for all problems when no user is provided (anonymous access).
    /// </summary>
    [Fact]
    public Task FilterReturnsEmptyListContentIdsForAnonymous() => RunTestAsync(async service =>
    {
        // Arrange — no user ID
        var query = new ProblemFilterOptions(
            new ProblemFilterQuery(
                new ProblemFilterCriteria(
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
                FavoritesOnly: false
            ),
            UserId: null,
            Language: Language.SK
        );

        // Act
        var result = await service.FilterAsync(query);

        // Assert — all problems should have empty ListContentIds
        Assert.All(result.Problems.Items, p => Assert.Empty(p.ListContentIds));
    });

    /// <summary>
    /// Verifies that ListContentIds only includes lists owned by the requesting user.
    /// User2 owns no lists with items, so all their ListContentIds should be empty
    /// even for problems that user1 has in their lists.
    /// </summary>
    [Fact]
    public Task FilterReturnsListContentIdsIsolatedBetweenUsers() => RunTestAsync(async service =>
    {
        // Arrange — query as user2 (owns only an empty list)
        var user2Id = Guid.Parse("00000000-0000-0000-0000-000000000002");

        var query = new ProblemFilterOptions(
            new ProblemFilterQuery(
                new ProblemFilterCriteria(
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
                FavoritesOnly: false
            ),
            UserId: user2Id,
            Language: Language.SK
        );

        // Act
        var result = await service.FilterAsync(query);

        // Assert — user2 has no items in any list, so all should be empty
        var p1 = result.Problems.Items.First(p => p.Slug == "75-a-i-1");
        var p2 = result.Problems.Items.First(p => p.Slug == "75-b-i-1");

        Assert.Empty(p1.ListContentIds);
        Assert.Empty(p2.ListContentIds);
    });

    #endregion

    #region Mark Status Projection Tests

    /// <summary>
    /// Verifies that the Marked boolean is correctly projected for different users and anonymous access.
    /// Seed data: p1 and p3 are marked by user1, p3 is marked by user2.
    /// </summary>
    [Fact]
    public Task FilterReturnsCorrectMarkInformation() => RunTestAsync(async service =>
    {
        // Arrange
        var user1Id = Guid.Parse("00000000-0000-0000-0000-000000000001");
        var user2Id = Guid.Parse("00000000-0000-0000-0000-000000000002");

        var baseQuery = new ProblemFilterOptions(
            new ProblemFilterQuery(
                new ProblemFilterCriteria(
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
                FavoritesOnly: false
            ),
            UserId: null,
            Language: Language.SK
        );

        // Act
        var resultUser1 = await service.FilterAsync(baseQuery with { UserId = user1Id });
        var resultUser2 = await service.FilterAsync(baseQuery with { UserId = user2Id });
        var resultAnon = await service.FilterAsync(baseQuery);

        // Assert: User1 — p1 and p3 are marked
        var p1User1 = resultUser1.Problems.Items.First(problem => problem.Slug == "75-a-i-1");
        var p2User1 = resultUser1.Problems.Items.First(problem => problem.Slug == "75-b-i-1");
        var p3User1 = resultUser1.Problems.Items.First(problem => problem.Slug == "75-c-i-1");

        Assert.True(p1User1.Marked);
        Assert.False(p2User1.Marked);
        Assert.True(p3User1.Marked);

        // Assert: User2 — only p3 is marked
        var p1User2 = resultUser2.Problems.Items.First(problem => problem.Slug == "75-a-i-1");
        var p3User2 = resultUser2.Problems.Items.First(problem => problem.Slug == "75-c-i-1");

        Assert.False(p1User2.Marked);
        Assert.True(p3User2.Marked);

        // Assert: Anonymous — all unmarked
        Assert.All(resultAnon.Problems.Items, problem => Assert.False(problem.Marked));
    });

    /// <summary>
    /// Verifies that filtering with MarkStatus.Marked returns only problems marked by the user.
    /// </summary>
    [Fact]
    public Task FilterByMarkStatusMarkedReturnsOnlyMarkedProblems() => RunTestAsync(async service =>
    {
        // Arrange — user1 has marked p1 and p3
        var user1Id = Guid.Parse("00000000-0000-0000-0000-000000000001");

        var query = new ProblemFilterOptions(
            new ProblemFilterQuery(
                new ProblemFilterCriteria(
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
                MarkStatus: MarkStatusFilter.Marked
            ),
            UserId: user1Id,
            Language: Language.SK
        );

        // Act
        var result = await service.FilterAsync(query);

        // Assert — p1 and p3 are marked by user1
        Assert.Equal(2, result.Problems.TotalCount);
        Assert.Contains(result.Problems.Items, problem => problem.Slug == "75-a-i-1");
        Assert.Contains(result.Problems.Items, problem => problem.Slug == "75-c-i-1");
        Assert.All(result.Problems.Items, problem => Assert.True(problem.Marked));
    });

    /// <summary>
    /// Verifies that filtering with MarkStatus.Unmarked returns only problems NOT marked by the user.
    /// </summary>
    [Fact]
    public Task FilterByMarkStatusUnmarkedReturnsOnlyUnmarkedProblems() => RunTestAsync(async service =>
    {
        // Arrange — user1 has marked p1 and p3, so 5 problems should be unmarked
        var user1Id = Guid.Parse("00000000-0000-0000-0000-000000000001");

        var query = new ProblemFilterOptions(
            new ProblemFilterQuery(
                new ProblemFilterCriteria(
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
                MarkStatus: MarkStatusFilter.Unmarked
            ),
            UserId: user1Id,
            Language: Language.SK
        );

        // Act
        var result = await service.FilterAsync(query);

        // Assert — 5 out of 7 problems are unmarked (p2, p4, p5, p6, p7)
        Assert.Equal(5, result.Problems.TotalCount);
        Assert.DoesNotContain(result.Problems.Items, problem => problem.Slug == "75-a-i-1");
        Assert.DoesNotContain(result.Problems.Items, problem => problem.Slug == "75-c-i-1");
        Assert.All(result.Problems.Items, problem => Assert.False(problem.Marked));
    });

    #endregion

    /// <inheritdoc />
    protected override async Task SeedDataAsync(MathCompsDbContext context)
    {
        // Seasons - Test data spans multiple years to test season filtering
        // We create two seasons to test filtering by different competition years
        var season2025 = new Season
        {
            Id = Guid.NewGuid(),
            StartYear = 2025,
            EditionNumber = 75
        };
        var season2024 = new Season
        {
            Id = Guid.NewGuid(),
            StartYear = 2024,
            EditionNumber = 74
        };
        context.Seasons.AddRange(season2025, season2024);

        // Competition tree - Create both domestic (CSMO, which runs age categories) and international (IMO, which
        // runs as one flat sitting) branches, to test filtering across different tree shapes
        CompetitionTreeSeed.Root(context, "csmo", 100);
        CompetitionTreeSeed.Root(context, "imo", 200);

        // Rounds - each competition node's sitting in one season. Categories A, B, C represent different age
        // groups and Z9 the 9th grade, each a node between the competition and its rounds.
        var ri_2025_csmo_domestic_A = new Round
        {
            Id = Guid.NewGuid(),
            CompetitionId = CompetitionTreeSeed.Chain(context, "csmo-a-i").Id,
            SeasonId = season2025.Id,
            Date = new DateOnly(2025, 9, 1)  // Estimated: September (home round)
        };
        var ri_2025_csmo_domestic_B = new Round
        {
            Id = Guid.NewGuid(),
            CompetitionId = CompetitionTreeSeed.Chain(context, "csmo-b-i").Id,
            SeasonId = season2025.Id,
            Date = new DateOnly(2025, 9, 1)  // Estimated: September (home round)
        };
        var ri_2025_csmo_domestic_C = new Round
        {
            Id = Guid.NewGuid(),
            CompetitionId = CompetitionTreeSeed.Chain(context, "csmo-c-i").Id,
            SeasonId = season2025.Id,
            Date = new DateOnly(2025, 9, 1)
        };
        var ri_2024_csmo_domestic_Z9 = new Round
        {
            Id = Guid.NewGuid(),
            CompetitionId = CompetitionTreeSeed.Chain(context, "csmo-z9-i").Id,
            SeasonId = season2024.Id,
            Date = new DateOnly(2024, 9, 1)
        };
        var ri_2024_csmo_regional_Z9 = new Round
        {
            Id = Guid.NewGuid(),
            CompetitionId = CompetitionTreeSeed.Chain(context, "csmo-z9-iii").Id,
            SeasonId = season2024.Id,
            Date = new DateOnly(2025, 4, 1)
        };
        var ri_2025_imo = new Round
        {
            Id = Guid.NewGuid(),
            SeasonId = season2025.Id,
            CompetitionId = CompetitionTreeSeed.Chain(context, "imo").Id,
            Date = new DateOnly(2026, 7, 15)
        };
        context.Rounds.AddRange(ri_2025_csmo_domestic_A, ri_2025_csmo_domestic_B, ri_2025_csmo_domestic_C, ri_2024_csmo_domestic_Z9, ri_2024_csmo_regional_Z9, ri_2025_imo);

        // Authors - Create multiple authors to test author filtering functionality
        // Patrik Bak will have the most problems (4) to test author result counts
        var authorBak = new Author
        {
            Id = Guid.NewGuid(),
            Name = "Patrik Bak",
            Slug = "patrik-bak"
        };
        var authorTkadlec = new Author
        {
            Id = Guid.NewGuid(),
            Name = "Josef Tkadlec",
            Slug = "josef-tkadlec"
        };
        var authorDomanyova = new Author
        {
            Id = Guid.NewGuid(),
            Name = "Mária Dományová",
            Slug = "maria-domanyova"
        };
        context.Authors.AddRange(authorBak, authorTkadlec, authorDomanyova);

        // Tags - Create different mathematical area tags to test tag filtering and combinations
        // These tags are strategically assigned to test both OR and AND logic scenarios
        var tagAlgebra = new Tag
        {
            Id = Guid.NewGuid(),
            Slug = "algebra",
            TagType = TagType.Area
        };
        var tagGeometry = new Tag
        {
            Id = Guid.NewGuid(),
            Slug = "geometry",
            TagType = TagType.Area
        };
        var tagNumberTheory = new Tag
        {
            Id = Guid.NewGuid(),
            Slug = "number-theory",
            TagType = TagType.Area
        };
        context.Tags.AddRange(tagAlgebra, tagGeometry, tagNumberTheory);

        // Problems - Create a diverse set of problems to test various filtering scenarios
        // Each problem is carefully designed to test specific aspects of the filtering system

        // Problem 1: Geometry problem by Josef Tkadlec in season 75, category A
        var p1 = new Problem
        {
            Id = Guid.NewGuid(),
            Slug = "75-a-i-1",
            RoundId = ri_2025_csmo_domestic_A.Id,
            Number = 1
        };
        p1.Texts.Add(new ProblemText
        {
            Id = Guid.NewGuid(),
            ProblemId = p1.Id,
            DocumentType = DocumentType.Statement,
            RawText = "Ostrov je rozdelený na niekoľko kráľovstiev.",
            MarkdownText = "Ostrov je rozdelený na niekoľko kráľovstiev.",
            Language = Language.SK,
            DateModified = DateTime.UtcNow,
            IsOriginal = true
        });
        // English translation for p1 - enables testing language-aware statement selection
        p1.Texts.Add(new ProblemText
        {
            Id = Guid.NewGuid(),
            ProblemId = p1.Id,
            DocumentType = DocumentType.Statement,
            RawText = "The island is divided into several kingdoms.",
            MarkdownText = "The island is divided into several kingdoms.",
            Language = Language.EN,
            DateModified = DateTime.UtcNow,
            IsOriginal = false
        });
        p1.ProblemAuthors.Add(new ProblemAuthor
        {
            ProblemId = p1.Id,
            AuthorId = authorTkadlec.Id,
            Ordinal = 1
        });
        p1.ProblemTagsAll.Add(new ProblemTag { ProblemId = p1.Id, TagId = tagGeometry.Id, GoodnessOfFit = 1.0f });

        // Problem 2: Problem with "štvorstena" (tetrahedron) for text search testing
        var p2 = new Problem
        {
            Id = Guid.NewGuid(),
            Slug = "75-b-i-1",
            RoundId = ri_2025_csmo_domestic_B.Id,
            Number = 1
        };
        p2.Texts.Add(new ProblemText
        {
            Id = Guid.NewGuid(),
            ProblemId = p2.Id,
            DocumentType = DocumentType.Statement,
            RawText = "Každej hrane štvorstena priradíme jedno reálne číslo.",
            MarkdownText = "Každej hrane štvorstena priradíme jedno reálne číslo.",
            Language = Language.SK,
            DateModified = DateTime.UtcNow,
            IsOriginal = true
        });
        p2.ProblemAuthors.Add(new ProblemAuthor
        {
            ProblemId = p2.Id,
            AuthorId = authorDomanyova.Id,
            Ordinal = 1
        });

        // Problem 3: Problem with "Prirodzené" for accent-insensitive search testing
        var p3 = new Problem
        {
            Id = Guid.NewGuid(),
            Slug = "75-c-i-1",
            RoundId = ri_2025_csmo_domestic_C.Id,
            Number = 1
        };
        p3.Texts.Add(new ProblemText
        {
            Id = Guid.NewGuid(),
            ProblemId = p3.Id,
            DocumentType = DocumentType.Statement,
            RawText = "Prirodzené číslo zapísané navzájom rôznymi ciframi nazveme pitoreskné.",
            MarkdownText = "Prirodzené číslo zapísané navzájom rôznymi ciframi nazveme pitoreskné.",
            Language = Language.SK,
            DateModified = DateTime.UtcNow,
            IsOriginal = true
        });
        p3.ProblemAuthors.Add(new ProblemAuthor
        {
            ProblemId = p3.Id,
            AuthorId = authorBak.Id,
            Ordinal = 1
        });

        // Problem 4: Algebra problem by Patrik Bak in season 75, category A
        var p4 = new Problem
        {
            Id = Guid.NewGuid(),
            Slug = "75-a-i-2",
            RoundId = ri_2025_csmo_domestic_A.Id,
            Number = 2
        };
        p4.Texts.Add(new ProblemText
        {
            Id = Guid.NewGuid(),
            ProblemId = p4.Id,
            DocumentType = DocumentType.Statement,
            RawText = "Nech p, q sú reálne čísla také, že rovnici |x^2-1|=px+q...",
            MarkdownText = "Nech p, q sú reálne čísla také, že rovnici |x^2-1|=px+q...",
            Language = Language.SK,
            DateModified = DateTime.UtcNow,
            IsOriginal = true
        });
        p4.ProblemAuthors.Add(new ProblemAuthor
        {
            ProblemId = p4.Id,
            AuthorId = authorBak.Id,
            Ordinal = 1
        });
        p4.ProblemTagsAll.Add(new ProblemTag { ProblemId = p4.Id, TagId = tagAlgebra.Id, GoodnessOfFit = 1.0f });

        // Problem 5: Number theory problem by Patrik Bak in season 74, category Z9
        var p5 = new Problem
        {
            Id = Guid.NewGuid(),
            Slug = "74-z9-i-1",
            RoundId = ri_2024_csmo_domestic_Z9.Id,
            Number = 1
        };
        p5.Texts.Add(new ProblemText
        {
            Id = Guid.NewGuid(),
            ProblemId = p5.Id,
            DocumentType = DocumentType.Statement,
            RawText = "Nájdite všetky dvojice celých čísel x a y takých, že x+y je prvočíslo a 3x+5y je 16.",
            MarkdownText = "Nájdite všetky dvojice celých čísel x a y takých, že x+y je prvočíslo a 3x+5y je 16.",
            Language = Language.SK,
            DateModified = DateTime.UtcNow,
            IsOriginal = true
        });
        p5.ProblemAuthors.Add(new ProblemAuthor
        {
            ProblemId = p5.Id,
            AuthorId = authorBak.Id,
            Ordinal = 1
        });
        p5.ProblemTagsAll.Add(new ProblemTag { ProblemId = p5.Id, TagId = tagNumberTheory.Id, GoodnessOfFit = 1.0f });

        // Problem 6: Another problem by Patrik Bak in season 74, regional round
        var p6 = new Problem
        {
            Id = Guid.NewGuid(),
            Slug = "74-z9-iii-1",
            RoundId = ri_2024_csmo_regional_Z9.Id,
            Number = 1
        };
        p6.Texts.Add(new ProblemText
        {
            Id = Guid.NewGuid(),
            ProblemId = p6.Id,
            DocumentType = DocumentType.Statement,
            RawText = "Do divadla dorazili diváci buď peši, autami alebo autobusmi.",
            MarkdownText = "Do divadla dorazili diváci buď peši, autami alebo autobusmi.",
            Language = Language.SK,
            DateModified = DateTime.UtcNow,
            IsOriginal = true
        });
        p6.ProblemAuthors.Add(new ProblemAuthor
        {
            ProblemId = p6.Id,
            AuthorId = authorBak.Id,
            Ordinal = 1
        });

        // Problem 7: IMO problem by Patrik Bak with geometry tag (for complex filtering tests)
        var p7 = new Problem
        {
            Id = Guid.NewGuid(),
            Slug = "imo-2025-1",
            RoundId = ri_2025_imo.Id,
            Number = 1
        };
        p7.Texts.Add(new ProblemText
        {
            Id = Guid.NewGuid(),
            ProblemId = p7.Id,
            DocumentType = DocumentType.Statement,
            RawText = "Some IMO problem",
            MarkdownText = "Some IMO problem",
            Language = Language.EN,
            DateModified = DateTime.UtcNow,
            IsOriginal = true
        });
        p7.ProblemAuthors.Add(new ProblemAuthor
        {
            ProblemId = p7.Id,
            AuthorId = authorBak.Id,
            Ordinal = 1
        });
        p7.ProblemTagsAll.Add(new ProblemTag { ProblemId = p7.Id, TagId = tagGeometry.Id, GoodnessOfFit = 1.0f });

        // Add all problems to the context and save changes
        // This creates 7 problems with the following distribution:
        // - Patrik Bak: 5 problems (p3, p4, p5, p6, p7)
        // - Josef Tkadlec: 1 problem (p1)
        // - Mária Dományová: 1 problem (p2)
        // - Geometry tag: 2 problems (p1, p7)
        // - Algebra tag: 1 problem (p4)
        // - Number theory tag: 1 problem (p5)
        context.Problems.AddRange(p1, p2, p3, p4, p5, p6, p7);

        // Add users and likes for testing
        var user1Id = Guid.Parse("00000000-0000-0000-0000-000000000001");
        var user2Id = Guid.Parse("00000000-0000-0000-0000-000000000002");

        context.Users.Add(new User { Id = user1Id, ExternalId = "user1", DisplayName = "User 1", Email = "user1@example.com", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow });
        context.Users.Add(new User { Id = user2Id, ExternalId = "user2", DisplayName = "User 2", Email = "user2@example.com", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow });

        // p1 (75-a-i-1): Liked by user1
        context.ProblemLikes.Add(new ProblemLike { UserId = user1Id, ProblemId = p1.Id, CreatedAt = DateTimeOffset.UtcNow });

        // p2 (75-b-i-1): Liked by user1 and user2
        context.ProblemLikes.Add(new ProblemLike { UserId = user1Id, ProblemId = p2.Id, CreatedAt = DateTimeOffset.UtcNow });
        context.ProblemLikes.Add(new ProblemLike { UserId = user2Id, ProblemId = p2.Id, CreatedAt = DateTimeOffset.UtcNow });

        // Mark statuses for testing mark status projection and filtering
        // p1 (75-a-i-1): Marked by user1
        context.ProblemMarkStatuses.Add(new ProblemMarkStatus { UserId = user1Id, ProblemId = p1.Id, CreatedAt = DateTimeOffset.UtcNow });
        // p3 (75-c-i-1): Marked by user1 and user2
        context.ProblemMarkStatuses.Add(new ProblemMarkStatus { UserId = user1Id, ProblemId = p3.Id, CreatedAt = DateTimeOffset.UtcNow });
        context.ProblemMarkStatuses.Add(new ProblemMarkStatus { UserId = user2Id, ProblemId = p3.Id, CreatedAt = DateTimeOffset.UtcNow });

        // Add comments for testing
        // p1 (75-a-i-1): 1 active comment, 1 superseded comment
        var comment1 = new Comment
        {
            Id = Guid.NewGuid(),
            AuthorId = user1Id,
            Content = "First comment",
            CreatedAt = DateTimeOffset.UtcNow
        };
        var comment1Superseded = new Comment
        {
            Id = Guid.NewGuid(),
            AuthorId = user1Id,
            Content = "Old version",
            Status = CommentStatus.Superseded,
            CreatedAt = DateTimeOffset.UtcNow.AddMinutes(-10)
        };
        context.Comments.AddRange(comment1, comment1Superseded);
        context.ProblemComments.Add(new ProblemComment { ProblemId = p1.Id, CommentId = comment1.Id });
        context.ProblemComments.Add(new ProblemComment { ProblemId = p1.Id, CommentId = comment1Superseded.Id });

        // p2 (75-b-i-1): 2 comments
        var comment2 = new Comment
        {
            Id = Guid.NewGuid(),
            AuthorId = user1Id,
            Content = "Second comment",
            CreatedAt = DateTimeOffset.UtcNow
        };
        var comment3 = new Comment
        {
            Id = Guid.NewGuid(),
            AuthorId = user2Id,
            Content = "Third comment",
            CreatedAt = DateTimeOffset.UtcNow
        };
        context.Comments.AddRange(comment2, comment3);
        context.ProblemComments.Add(new ProblemComment { ProblemId = p2.Id, CommentId = comment2.Id });
        context.ProblemComments.Add(new ProblemComment { ProblemId = p2.Id, CommentId = comment3.Id });

        // Add user lists for list filtering tests
        var list1 = new UserProblemList
        {
            Id = Guid.CreateVersion7(),
            ContentId = "test-list-1",
            UserId = user1Id,
            Name = "My Test List",
            SortOrder = 1,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        var listEmpty = new UserProblemList
        {
            Id = Guid.CreateVersion7(),
            ContentId = "test-list-empty",
            UserId = user2Id,
            Name = "Empty List",
            SortOrder = 1,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        context.UserProblemLists.AddRange(list1, listEmpty);

        // Add p1 and p2 to user1's list
        context.UserProblemListItems.Add(new UserProblemListItem { ListId = list1.Id, ProblemId = p1.Id, AddedAt = DateTimeOffset.UtcNow });
        context.UserProblemListItems.Add(new UserProblemListItem { ListId = list1.Id, ProblemId = p2.Id, AddedAt = DateTimeOffset.UtcNow });

        // Second list for user1 — p2 is in both lists (for ListContentIds multi-membership test)
        var list2 = new UserProblemList
        {
            Id = Guid.CreateVersion7(),
            ContentId = "test-list-2",
            UserId = user1Id,
            Name = "Second List",
            SortOrder = 2,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        context.UserProblemLists.Add(list2);
        context.UserProblemListItems.Add(new UserProblemListItem { ListId = list2.Id, ProblemId = p2.Id, AddedAt = DateTimeOffset.UtcNow });

        // Submit changes
        await context.SaveChangesAsync();
    }

    /// <summary>
    /// An out-of-range page request is clamped rather than trusted: the page size caps at the configured
    /// maximum (the DoS guard), a non-positive page number floors to the first page, and one past the ceiling
    /// caps at it rather than being multiplied out into an offset the database is handed as a negative.
    /// </summary>
    [Fact]
    public Task OutOfRangePagingIsClamped() => RunTestAsync(async service =>
    {
        // Arrange - ask for a wildly oversized page and a non-positive page number
        var flooredQuery = new ProblemFilterOptions(
            new ProblemFilterQuery(
                new ProblemFilterCriteria(
                    SearchText: string.Empty,
                    SearchInSolution: false,
                    OlympiadYears: [],
                    CompetitionPaths: [],
                    ProblemNumbers: [],
                    TagSlugs: [],
                    TagLogic: LogicToggle.Or,
                    AuthorSlugs: [],
                    AuthorLogic: LogicToggle.Or
                ),
                PageSize: 100_000,
                PageNumber: 0,
                FavoritesOnly: false
            ),
            UserId: null,
            Language: Language.SK
        );

        // Arrange - and the same request as far into the results as a page number can reach
        var cappedQuery = flooredQuery with
        {
            Query = flooredQuery.Query with { PageNumber = int.MaxValue }
        };

        // Act - run the filter with the out-of-range paging
        var flooredResult = await service.FilterAsync(flooredQuery);

        // Act - and with the page number past the ceiling
        var cappedResult = await service.FilterAsync(cappedQuery);

        // Assert - the page size is capped at the configured maximum
        Assert.Equal(100, flooredResult.Problems.PageSize);

        // Assert - the page number floors to the first page
        Assert.Equal(1, flooredResult.Problems.Page);

        // Assert - and the far page reached the database at all, which is the whole point of bounding it: the
        // unbounded skip overflows to a negative offset that Postgres refuses outright
        Assert.Empty(cappedResult.Problems.Items);
    });
}

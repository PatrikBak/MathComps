using DotNet.Testcontainers.Builders;
using DotNet.Testcontainers.Containers;
using MathComps.Domain.ApiDtos.Helpers;
using MathComps.Domain.ApiDtos.ProblemQuery;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Extensions;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace MathComps.Infrastructure.Tests;

/// <summary>
/// Integration tests for the EF-backed <see cref="ProblemFilterService"/> using a disposable PostgreSQL container.
/// </summary>
public class ProblemFilterServicePostgresTests : IAsyncLifetime
{
    /// <summary>
    /// The docker container 
    /// </summary>
    private readonly IContainer _postgresContainer;

    /// <summary>
    /// The connection string for the PostgreSQL container, initialized after the container starts.
    /// </summary>
    private readonly string _connectionString;

    /// <summary>
    /// Initializes a new instance of the <see cref="ProblemFilterServicePostgresTests"/> class.
    /// Sets up the PostgreSQL container for testing.
    /// </summary>
    public ProblemFilterServicePostgresTests()
    {
        try
        {
            // The common property for the connection string
            const string user = "postgres";
            const string password = "postgres";
            const string db = "mathcomps_service_test";
            const int port = 5432;

            // Create PostgreSQL container with pgvector extension for vector similarity operations.
            _postgresContainer = new ContainerBuilder()
                // Use pgvector image with PostgreSQL 16 for embedding similarity
                .WithImage("pgvector/pgvector:pg16")
                // The required envs
                .WithEnvironment("POSTGRES_USER", user)
                .WithEnvironment("POSTGRES_PASSWORD", password)
                .WithEnvironment("POSTGRES_DB", db)
                // Bind to random available port (0) to avoid conflicts with other services
                .WithPortBinding(0, port)
                // Wait for DB to be ready before proceeding
                .WithWaitStrategy(Wait.ForUnixContainer().UntilPortIsAvailable(5432))
                .Build();

            // Initialize the connection string after the container is built
            _connectionString = $"Host=localhost;Port={port};Database={db};Username={user};Password={password}";

        }
        catch (DockerUnavailableException)
        {
            // We need Docker!
            throw new InvalidOperationException(
                """
                Docker Desktop is required to run Postgres integration tests
                  - Install Docker Desktop (Windows/Mac) or Docker Engine (Linux)
                  - Start Docker and ensure 'docker info' works
                  - On Windows, enable WSL 2 backend in Docker Desktop settings
                """
            );
        }
    }

    /// <summary>
    /// Initializes the test environment by starting the PostgreSQL container and seeding test data.
    /// This method is called before each test class execution to ensure a clean, isolated database state.
    /// </summary>
    /// <returns>A task representing the asynchronous initialization operation.</returns>
    public async Task InitializeAsync()
    {
        // Make sure the container's on
        await _postgresContainer.StartAsync();

        // Create the DB context using the service provider
        await using var serviceProvider = CreateServiceProvider();
        await using var scope = serviceProvider.CreateAsyncScope();
        var context = scope.ServiceProvider.GetRequiredService<MathCompsDbContext>();

        // Ensure we start with a completely clean database state for each test run
        await context.Database.EnsureDeletedAsync();
        await context.Database.MigrateAsync();

        // Seed the database with test data
        await SeedData(context);
    }

    /// <summary>
    /// Cleans up the test environment by stopping and disposing of the PostgreSQL container.
    /// This method is called after all tests in the class have completed to free up resources.
    /// </summary>
    /// <returns>A task representing the asynchronous cleanup operation.</returns>
    public async Task DisposeAsync()
    {
        // Stop and dispose the container to free up resources
        await (_postgresContainer?.StopAsync() ?? Task.CompletedTask);
        await (_postgresContainer?.DisposeAsync() ?? ValueTask.CompletedTask);
    }

    /// <summary>
    /// Creates a service provider configured with the test database connection string.
    /// </summary>
    /// <returns>A configured service provider ready for dependency injection.</returns>
    private ServiceProvider CreateServiceProvider()
    {
        // Create in-memory configuration with the test database connection string
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:DefaultConnection"] = _connectionString
            })
            .Build();

        // Register all necessary services for the ProblemFilterService to function
        return new ServiceCollection()
            .AddSingleton<IConfiguration>(configuration)
            .AddMathCompsDbContext(configuration)
            .AddInfrastructureServices()
            .BuildServiceProvider();
    }

    /// <summary>
    /// Executes filtering using the <see cref="IProblemFilterService"/>. This helper method
    /// encapsulates the common pattern of creating a service scope, executing a filter query,
    /// and ensuring proper disposal of resources.
    /// </summary>
    /// <param name="filterOptions">The filter options to execute.</param>
    /// <returns>The filter result from the <see cref="IProblemFilterService"/>.</returns>
    private async Task<FilterResult> ExecuteFiltering(ProblemFilterOptions filterOptions)
    {
        // Create a new service provider for each test to ensure proper isolation.
        using var serviceProvider = CreateServiceProvider();
        await using var scope = serviceProvider.CreateAsyncScope();

        // Get the service
        return await scope.ServiceProvider.GetRequiredService<IProblemFilterService>()
            // Execute the filter query
            .FilterAsync(filterOptions);
    }

    /// <summary>
    /// Verifies that an initial load with no filters returns all problems and available filter options.
    /// This test ensures the service correctly handles the baseline case where no filtering is applied,
    /// returning the complete dataset along with all available filter options for the UI.
    /// </summary>
    [Fact]
    public async Task FilterInitialLoadReturnsAllProblemsAndOptions()
    {
        // Arrange - create a query with no filters to test the baseline behavior
        var initialQuery = new ProblemFilterOptions(
            new FilterQuery(
                new FilterParameters(
                    SearchText: string.Empty,
                    SearchInSolution: false,
                    OlympiadYears: [],
                    Contests: [],
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
            UserId: null
        );

        // Act - execute the filter with no criteria
        var initialResult = await ExecuteFiltering(initialQuery);

        // Assert - verify we get all problems and all available filter options
        Assert.Equal(7, initialResult.Problems.TotalCount);
        Assert.NotNull(initialResult.UpdatedOptions);
        Assert.Equal(2, initialResult.UpdatedOptions!.Seasons.Count);
        Assert.Equal(2, initialResult.UpdatedOptions.Competitions.Count);
        Assert.Equal(3, initialResult.UpdatedOptions.Authors.Count);
        Assert.Equal(3, initialResult.UpdatedOptions.Tags.Count);
    }

    /// <summary>
    /// Verifies that filtering by search text returns only problems containing the specified text.
    /// This test ensures the text search functionality works correctly by searching for a specific
    /// Slovak word that appears in one of our test problems.
    /// </summary>
    [Fact]
    public async Task FilterBySearchTextReturnsMatchingProblems()
    {
        // Arrange - search for "štvorstena" (tetrahedron in Slovak) which appears in problem 75-b-i-1
        var textSearchQuery = new ProblemFilterOptions(
            new FilterQuery(
                new FilterParameters(
                    SearchText: "štvorstena",
                    SearchInSolution: false,
                    OlympiadYears: [],
                    Contests: [],
                    ProblemNumbers: [],
                    TagSlugs: [],
                    TagLogic: LogicToggle.Or,
                    AuthorSlugs: [],
                    AuthorLogic: LogicToggle.Or),
                PageSize: 10,
                PageNumber: 1,
                FavoritesOnly: false
            ),
            UserId: null
        );

        // Act - execute the text search
        var textSearchResult = await ExecuteFiltering(textSearchQuery);

        // Assert - verify we get exactly one matching problem
        Assert.Single(textSearchResult.Problems.Items);
        Assert.Equal("75-b-i-1", textSearchResult.Problems.Items[0].Slug);
    }

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
    public async Task FilterBySearchTextIsCaseInsensitiveAndAccentInsensitive()
    {
        // Arrange - test various text normalization scenarios that users might encounter
        // Test 1: lowercase without accents should match "štvorstena" (with accents)
        var lowercaseQuery = new ProblemFilterOptions(
            new FilterQuery(
                new FilterParameters(
                    SearchText: "stvorstena",
                    SearchInSolution: false,
                    OlympiadYears: [],
                    Contests: [],
                        ProblemNumbers: [],
                    TagSlugs: [],
                    TagLogic: LogicToggle.Or,
                    AuthorSlugs: [],
                    AuthorLogic: LogicToggle.Or),
                PageSize: 10,
                PageNumber: 1,
                FavoritesOnly: false
            ),
            UserId: null
        );

        // Test 2: UPPERCASE without accents should match "štvorstena" (lowercase with accents)
        var uppercaseQuery = new ProblemFilterOptions(
            new FilterQuery(
                new FilterParameters(
                    SearchText: "STVORSTENA",
                    SearchInSolution: false,
                    OlympiadYears: [],
                    Contests: [],
                    ProblemNumbers: [],
                    TagSlugs: [],
                    TagLogic: LogicToggle.Or,
                    AuthorSlugs: [],
                    AuthorLogic: LogicToggle.Or),
                PageSize: 10,
                PageNumber: 1,
                FavoritesOnly: false
            ),
            UserId: null
        );

        // Test 3: UPPERCASE without accents should match "Prirodzené" (different case with accents)
        var mixedCaseQuery = new ProblemFilterOptions(
            new FilterQuery(
                new FilterParameters(
                    SearchText: "PRIRODZENE",
                    SearchInSolution: false,
                    OlympiadYears: [],
                    Contests: [],
                    ProblemNumbers: [],
                    TagSlugs: [],
                    TagLogic: LogicToggle.Or,
                    AuthorSlugs: [],
                    AuthorLogic: LogicToggle.Or),
                PageSize: 10,
                PageNumber: 1,
                FavoritesOnly: false
            ),
            UserId: null
        );

        // Test 4: lowercase without accents should match "Prirodzené" (different case with accents)
        var lowerToTitleQuery = new ProblemFilterOptions(
            new FilterQuery(
                new FilterParameters(
                    SearchText: "prirodzene",
                    SearchInSolution: false,
                    OlympiadYears: [],
                    Contests: [],
                    ProblemNumbers: [],
                    TagSlugs: [],
                    TagLogic: LogicToggle.Or,
                    AuthorSlugs: [],
                    AuthorLogic: LogicToggle.Or),
                PageSize: 10,
                PageNumber: 1,
                FavoritesOnly: false
            ),
            UserId: null
        );

        // Act - execute all search variations
        var lowercaseResult = await ExecuteFiltering(lowercaseQuery);
        var uppercaseResult = await ExecuteFiltering(uppercaseQuery);
        var mixedCaseResult = await ExecuteFiltering(mixedCaseQuery);
        var lowerToTitleResult = await ExecuteFiltering(lowerToTitleQuery);

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
    }

    /// <summary>
    /// Verifies that filtering by a single author returns all problems authored by that person.
    /// This test ensures the author filtering functionality works correctly and returns the
    /// expected number of problems for a specific author in our test dataset.
    /// </summary>
    [Fact]
    public async Task FilterBySingleAuthorReturnsCorrectProblems()
    {
        // Arrange - filter by Patrik Bak, who authored 5 problems in our test data
        var authorQuery = new ProblemFilterOptions(
            new FilterQuery(
                new FilterParameters(
                    SearchText: string.Empty,
                    SearchInSolution: false,
                    OlympiadYears: [],
                    Contests: [],
                        ProblemNumbers: [],
                    TagSlugs: [],
                    TagLogic: LogicToggle.Or,
                    AuthorSlugs: ["patrik-bak"],
                    AuthorLogic: LogicToggle.Or),
                PageSize: 10,
                PageNumber: 1,
                FavoritesOnly: false
            ),
            UserId: null
        );

        // Act - execute the author filter
        var authorResult = await ExecuteFiltering(authorQuery);

        // Assert - verify we get all 5 problems by Patrik Bak
        Assert.Equal(5, authorResult.Problems.TotalCount);
        Assert.All(authorResult.Problems.Items, problem => Assert.Contains(problem.Authors, author => author.DisplayName == "Patrik Bak"));
    }

    /// <summary>
    /// Verifies that filtering by multiple tags with OR logic returns problems that have any of the selected tags.
    /// This test ensures that when users select multiple tags with OR logic, they get problems
    /// that match any of the selected tags, not necessarily all of them.
    /// </summary>
    [Fact]
    public async Task FilterByMultipleTagsWithOrLogicReturnsCorrectProblems()
    {
        // Arrange - filter by algebra OR number-theory tags (should return 2 problems)
        var tagsOrQuery = new ProblemFilterOptions(
            new FilterQuery(
                new FilterParameters(
                    SearchText: string.Empty,
                    SearchInSolution: false,
                    OlympiadYears: [],
                    Contests: [],
                    ProblemNumbers: [],
                    TagSlugs: ["algebra", "number-theory"],
                    TagLogic: LogicToggle.Or,
                    AuthorSlugs: [],
                    AuthorLogic: LogicToggle.Or),
                PageSize: 10,
                PageNumber: 1,
                FavoritesOnly: false
            ),
            UserId: null
        );

        // Act - execute the OR tag filter
        var tagsOrResult = await ExecuteFiltering(tagsOrQuery);

        // Assert - verify we get problems with either algebra OR number-theory tags
        Assert.Equal(2, tagsOrResult.Problems.TotalCount);
    }

    /// <summary>
    /// Verifies that filtering by multiple tags with AND logic returns problems that have all of the selected tags.
    /// This test uses tags that don't overlap in our test data to ensure the AND logic works correctly
    /// by returning no results when no problems have all the specified tags.
    /// </summary>
    [Fact]
    public async Task FilterByMultipleTagsWithAndLogicReturnsNoProblemsWhenNoneMatchAll()
    {
        // Arrange - filter by algebra AND number-theory tags (no problems have both in our test data)
        var tagsAndQuery = new ProblemFilterOptions(
            new FilterQuery(
                new FilterParameters(
                    SearchText: string.Empty,
                    SearchInSolution: false,
                    OlympiadYears: [],
                    Contests: [],
                    ProblemNumbers: [],
                    TagSlugs: ["algebra", "number-theory"],
                    TagLogic: LogicToggle.And,
                    AuthorSlugs: [],
                    AuthorLogic: LogicToggle.Or),
                PageSize: 10,
                PageNumber: 1,
                FavoritesOnly: false
            ),
            UserId: null
        );

        // Act - execute the AND tag filter
        var tagsAndResult = await ExecuteFiltering(tagsAndQuery);

        // Assert - verify we get no results since no problems have both tags
        Assert.Empty(tagsAndResult.Problems.Items);
    }

    /// <summary>
    /// Verifies that a complex filter with multiple criteria (Season, Category, and Tag) returns the correct subset of problems.
    /// This test ensures that when multiple filter criteria are applied simultaneously, the service
    /// correctly combines them using AND logic to return only problems that match all criteria.
    /// </summary>
    [Fact]
    public async Task FilterWithComplexQueryReturnsCorrectProblems()
    {
        // Arrange - filter by season 75 AND geometry tag (should return 2 problems)
        var complexQuery = new ProblemFilterOptions(
            new FilterQuery(
                new FilterParameters(
                    SearchText: string.Empty,
                    SearchInSolution: false,
                    OlympiadYears: [75],
                    Contests: [],
                    ProblemNumbers: [],
                    TagSlugs: ["geometry"],
                    TagLogic: LogicToggle.Or,
                    AuthorSlugs: [],
                    AuthorLogic: LogicToggle.Or),
                PageSize: 10,
                PageNumber: 1,
                FavoritesOnly: false
            ),
            UserId: null
        );

        // Act - execute the complex multi-criteria filter
        var complexQueryResult = await ExecuteFiltering(complexQuery);

        // Assert - verify we get exactly 2 problems that match both season 75 and geometry tag
        Assert.Equal(2, complexQueryResult.Problems.Items.Count);
        foreach (var problem in complexQueryResult.Problems.Items)
        {
            Assert.Equal("75", problem.Source.Season.Slug);
            Assert.Contains(problem.Tags, tag => tag.Slug == "geometry");
        }
    }

    /// <summary>
    /// Verifies that pagination works correctly, returning the correct number of items for each page.
    /// This test ensures that when results are split across multiple pages, each page contains
    /// the expected number of items and the total count remains consistent across pages.
    /// </summary>
    [Fact]
    public async Task FilterWithPaginationReturnsCorrectPages()
    {
        // Arrange - create queries for page 1 (4 items) and page 2 (remaining items)
        var page1Query = new ProblemFilterOptions(
            new FilterQuery(
                new FilterParameters(
                    SearchText: string.Empty,
                    SearchInSolution: false,
                    OlympiadYears: [],
                    Contests: [],
                        ProblemNumbers: [],
                    TagSlugs: [],
                    TagLogic: LogicToggle.Or,
                    AuthorSlugs: [],
                    AuthorLogic: LogicToggle.Or),
                PageSize: 4,
                PageNumber: 1,
                FavoritesOnly: false
            ),
            UserId: null
        );
        var page2Query = new ProblemFilterOptions(
            new FilterQuery(
                new FilterParameters(
                    SearchText: string.Empty,
                    SearchInSolution: false,
                    OlympiadYears: [],
                    Contests: [],
                    ProblemNumbers: [],
                    TagSlugs: [],
                    TagLogic: LogicToggle.Or,
                    AuthorSlugs: [],
                    AuthorLogic: LogicToggle.Or),
                PageSize: 4,
                PageNumber: 2,
                FavoritesOnly: false
            ),
            UserId: null
        );

        // Act - execute both page queries
        var page1Result = await ExecuteFiltering(page1Query);
        var page2Result = await ExecuteFiltering(page2Query);

        // Assert - verify pagination works correctly with 7 total problems
        Assert.Equal(4, page1Result.Problems.Items.Count);
        Assert.Equal(7, page1Result.Problems.TotalCount);
        Assert.Equal(3, page2Result.Problems.Items.Count);
        Assert.Equal(7, page2Result.Problems.TotalCount);
    }

    /// <summary>
    /// Verifies that a query with criteria that should not match any problems returns an empty result set.
    /// This test ensures the service handles edge cases gracefully and returns appropriate empty results
    /// when no problems match the specified criteria, rather than throwing exceptions.
    /// </summary>
    [Fact]
    public async Task FilterWithNoMatchingCriteriaReturnsEmptyResult()
    {
        // Arrange - search for text that doesn't exist in any problem statement
        var noResultsQuery = new ProblemFilterOptions(
            new FilterQuery(
                new FilterParameters(
                    SearchText: "non_existent_text_gibrish",
                    SearchInSolution: false,
                    OlympiadYears: [],
                    Contests: [],
                    ProblemNumbers: [],
                    TagSlugs: [],
                    TagLogic: LogicToggle.Or,
                    AuthorSlugs: [],
                    AuthorLogic: LogicToggle.Or),
                PageSize: 10,
                PageNumber: 1,
                FavoritesOnly: false
            ),
            UserId: null
        );

        // Act - execute the query that should return no results
        var noResultsResult = await ExecuteFiltering(noResultsQuery);

        // Assert - verify we get an empty result set with zero total count
        Assert.Empty(noResultsResult.Problems.Items);
        Assert.Equal(0, noResultsResult.Problems.TotalCount);
    }
    /// <summary>
    /// Verifies that filtering returns correct like information (Liked status and LikeCount).
    /// This test ensures that:
    /// 1. LikeCount accurately reflects the total number of likes.
    /// 2. Liked is true for problems liked by the requesting user.
    /// 3. Liked is false for problems not liked by the requesting user.
    /// 4. Liked is false when no user is provided (anonymous access).
    /// </summary>
    [Fact]
    public async Task FilterReturnsCorrectLikeInformation()
    {
        // Arrange - Use seeded users
        var user1Id = Guid.Parse("00000000-0000-0000-0000-000000000001");
        var user2Id = Guid.Parse("00000000-0000-0000-0000-000000000002");

        // Act 1: Query as User 1
        var baseQuery = new ProblemFilterOptions(
            new FilterQuery(
                new FilterParameters(
                    SearchText: string.Empty,
                    SearchInSolution: false,
                    OlympiadYears: [],
                    Contests: [],
                    ProblemNumbers: [],
                    TagSlugs: [],
                    TagLogic: LogicToggle.Or,
                    AuthorSlugs: [],
                    AuthorLogic: LogicToggle.Or),
                PageSize: 10,
                PageNumber: 1,
                FavoritesOnly: false
            ),
            UserId: null
        );
        var resultUser1 = await ExecuteFiltering(baseQuery with { UserId = user1Id });

        // Act 2: Query as User 2
        var resultUser2 = await ExecuteFiltering(baseQuery with { UserId = user2Id });

        // Act 3: Query as Anonymous
        var resultAnon = await ExecuteFiltering(baseQuery);

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
    }

    /// <summary>
    /// Verifies that filtering with FavoritesOnly returns only problems liked by the requesting user.
    /// This test ensures that:
    /// 1. When FavoritesOnly is true and a user is provided, only problems liked by that user are returned.
    /// 2. When FavoritesOnly is false, all problems are returned regardless of like status.
    /// 3. When FavoritesOnly is true but no user is provided, no problems are returned (anonymous users have no favorites).
    /// </summary>
    [Fact]
    public async Task FilterWithFavoritesOnlyReturnsOnlyLikedProblems()
    {
        // Arrange - Use seeded users
        var user1Id = Guid.Parse("00000000-0000-0000-0000-000000000001");
        var user2Id = Guid.Parse("00000000-0000-0000-0000-000000000002");

        // Create base query with FavoritesOnly = true
        var favoritesQuery = new ProblemFilterOptions(
            new FilterQuery(
                new FilterParameters(
                    SearchText: string.Empty,
                    SearchInSolution: false,
                    OlympiadYears: [],
                    Contests: [],
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
            UserId: null
        );

        // Act 1: Query favorites for User 1 (liked 75-a-i-1 and 75-b-i-1)
        var resultUser1Favorites = await ExecuteFiltering(favoritesQuery with { UserId = user1Id });

        // Act 2: Query favorites for User 2 (liked only 75-b-i-1)
        var resultUser2Favorites = await ExecuteFiltering(favoritesQuery with { UserId = user2Id });

        // Act 3: Query favorites for Anonymous (should return nothing)
        var resultAnonFavorites = await ExecuteFiltering(favoritesQuery);

        // Act 4: Query all problems for User 1 (FavoritesOnly = false)
        var allProblemsQuery = favoritesQuery with { Query = favoritesQuery.Query with { FavoritesOnly = false } };
        var resultUser1All = await ExecuteFiltering(allProblemsQuery with { UserId = user1Id });

        // Assert 1: User 1 favorites - should get 2 problems (75-a-i-1 and 75-b-i-1)
        Assert.Equal(2, resultUser1Favorites.Problems.TotalCount);
        Assert.Contains(resultUser1Favorites.Problems.Items, p => p.Slug == "75-a-i-1");
        Assert.Contains(resultUser1Favorites.Problems.Items, p => p.Slug == "75-b-i-1");
        Assert.All(resultUser1Favorites.Problems.Items, p => Assert.True(p.Liked));

        // Assert 2: User 2 favorites - should get 1 problem (75-b-i-1)
        Assert.Single(resultUser2Favorites.Problems.Items);
        Assert.Equal("75-b-i-1", resultUser2Favorites.Problems.Items[0].Slug);
        Assert.True(resultUser2Favorites.Problems.Items[0].Liked);

        // Assert 3: Anonymous favorites - should get 0 problems
        Assert.Empty(resultAnonFavorites.Problems.Items);
        Assert.Equal(0, resultAnonFavorites.Problems.TotalCount);

        // Assert 4: User 1 all problems - should get all 7 problems
        Assert.Equal(7, resultUser1All.Problems.TotalCount);
    }

    /// <summary>
    /// Seeds the test database with a comprehensive set of test data including seasons, 
    /// competitions, categories, rounds, authors, tags, and problems. 
    /// </summary>
    /// <param name="context">The database context to seed with test data.</param>
    /// <returns>A task representing the asynchronous seeding operation.</returns>
    private static async Task SeedData(MathCompsDbContext context)
    {
        // Seasons - Test data spans multiple years to test season filtering
        // We create two seasons to test filtering by different competition years
        var season2025 = new Season
        {
            Id = Guid.NewGuid(),
            StartYear = 2025,
            EditionLabel = "75. ročník",
            EditionNumber = 75
        };
        var season2024 = new Season
        {
            Id = Guid.NewGuid(),
            StartYear = 2024,
            EditionLabel = "74. ročník",
            EditionNumber = 74
        };
        context.Seasons.AddRange(season2025, season2024);

        // Competitions - Create both domestic (CSMO) and international (IMO) competitions
        // to test filtering by different competition types
        var csmo = new Competition
        {
            Id = Guid.NewGuid(),
            DisplayName = "CSMO",
            FullName = "Matematická Olympiáda",
            Slug = "csmo",
            SortOrder = 100
        };
        var imo = new Competition
        {
            Id = Guid.NewGuid(),
            DisplayName = "IMO",
            FullName = "International Mathematical Olympiad",
            Slug = "imo",
            SortOrder = 200
        };
        context.Competitions.AddRange(csmo, imo);

        // Categories - Create different age/grade categories to test category filtering
        // Categories A, B, C represent different age groups, Z9 represents 9th grade
        var catA = new Category
        {
            Id = Guid.NewGuid(),
            Name = "A",
            Slug = "a",
            SortOrder = 100
        };
        var catB = new Category
        {
            Id = Guid.NewGuid(),
            Name = "B",
            Slug = "b",
            SortOrder = 200
        };
        var catC = new Category
        {
            Id = Guid.NewGuid(),
            Name = "C",
            Slug = "c",
            SortOrder = 300
        };
        var catZ9 = new Category
        {
            Id = Guid.NewGuid(),
            Name = "Z9",
            Slug = "z9",
            SortOrder = 400
        };
        context.Categories.AddRange(catA, catB, catC, catZ9);

        // Rounds
        var roundCsmoDomesticA = new Round
        {
            Id = Guid.NewGuid(),
            CompetitionId = csmo.Id,
            CategoryId = catA.Id,
            DisplayName = "Domáce",
            FullName = "Domáce kolo",
            Slug = "i-a",
            CompositeSlug = "csmo-a-i",
            SortOrder = 100
        };
        var roundCsmoDomesticB = new Round
        {
            Id = Guid.NewGuid(),
            CompetitionId = csmo.Id,
            CategoryId = catB.Id,
            DisplayName = "Domáce",
            FullName = "Domáce kolo",
            Slug = "i-b",
            CompositeSlug = "csmo-b-i",
            SortOrder = 100
        };
        var roundCsmoDomesticC = new Round
        {
            Id = Guid.NewGuid(),
            CompetitionId = csmo.Id,
            CategoryId = catC.Id,
            DisplayName = "Domáce",
            FullName = "Domáce kolo",
            Slug = "i-c",
            CompositeSlug = "csmo-c-i",
            SortOrder = 100
        };
        var roundCsmoDomesticZ9 = new Round
        {
            Id = Guid.NewGuid(),
            CompetitionId = csmo.Id,
            CategoryId = catZ9.Id,
            DisplayName = "Domáce",
            FullName = "Domáce kolo",
            Slug = "i-z9",
            CompositeSlug = "csmo-z9-i",
            SortOrder = 100
        };
        var roundCsmoRegionalZ9 = new Round
        {
            Id = Guid.NewGuid(),
            CompetitionId = csmo.Id,
            CategoryId = catZ9.Id,
            DisplayName = "Krajské",
            FullName = "Krajské kolo",
            Slug = "iii-z9",
            CompositeSlug = "csmo-z9-iii",
            SortOrder = 200
        };
        var roundImo = new Round
        {
            Id = Guid.NewGuid(),
            CompetitionId = imo.Id,
            DisplayName = "",
            FullName = "",
            Slug = "",
            CompositeSlug = "imo",
            SortOrder = 1,
            IsDefault = true
        };
        context.Rounds.AddRange(roundCsmoDomesticA, roundCsmoDomesticB, roundCsmoDomesticC, roundCsmoDomesticZ9, roundCsmoRegionalZ9, roundImo);

        // Round Instances
        var ri_2025_csmo_domestic_A = new RoundInstance
        {
            Id = Guid.NewGuid(),
            RoundId = roundCsmoDomesticA.Id,
            SeasonId = season2025.Id,
            Date = new DateOnly(2025, 9, 1)  // Estimated: September (home round)
        };
        var ri_2025_csmo_domestic_B = new RoundInstance
        {
            Id = Guid.NewGuid(),
            RoundId = roundCsmoDomesticB.Id,
            SeasonId = season2025.Id,
            Date = new DateOnly(2025, 9, 1)  // Estimated: September (home round)
        };
        var ri_2025_csmo_domestic_C = new RoundInstance
        {
            Id = Guid.NewGuid(),
            RoundId = roundCsmoDomesticC.Id,
            SeasonId = season2025.Id,
            Date = new DateOnly(2025, 9, 1)
        };
        var ri_2024_csmo_domestic_Z9 = new RoundInstance
        {
            Id = Guid.NewGuid(),
            RoundId = roundCsmoDomesticZ9.Id,
            SeasonId = season2024.Id,
            Date = new DateOnly(2024, 9, 1)
        };
        var ri_2024_csmo_regional_Z9 = new RoundInstance
        {
            Id = Guid.NewGuid(),
            RoundId = roundCsmoRegionalZ9.Id,
            SeasonId = season2024.Id,
            Date = new DateOnly(2025, 4, 1)
        };
        var ri_2025_imo = new RoundInstance
        {
            Id = Guid.NewGuid(),
            SeasonId = season2025.Id,
            RoundId = roundImo.Id,
            Date = new DateOnly(2026, 7, 15)
        };
        context.RoundInstances.AddRange(ri_2025_csmo_domestic_A, ri_2025_csmo_domestic_B, ri_2025_csmo_domestic_C, ri_2024_csmo_domestic_Z9, ri_2024_csmo_regional_Z9, ri_2025_imo);

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
            Name = "Algebra",
            Slug = "algebra",
            TagType = TagType.Area
        };
        var tagGeometry = new Tag
        {
            Id = Guid.NewGuid(),
            Name = "Geometry",
            Slug = "geometry",
            TagType = TagType.Area
        };
        var tagNumberTheory = new Tag
        {
            Id = Guid.NewGuid(),
            Name = "Number Theory",
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
            RoundInstanceId = ri_2025_csmo_domestic_A.Id,
            Number = 1
        };
        p1.Texts.Add(new ProblemText
        {
            Id = Guid.NewGuid(),
            ProblemId = p1.Id,
            DocumentType = DocumentType.Statement,
            RawText = "Ostrov je rozdelený na niekoľko kráľovstiev.",
            ParsedText = "{}",
            Language = Language.SK,
            DateModified = DateTime.UtcNow,
            IsOriginal = true
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
            RoundInstanceId = ri_2025_csmo_domestic_B.Id,
            Number = 1
        };
        p2.Texts.Add(new ProblemText
        {
            Id = Guid.NewGuid(),
            ProblemId = p2.Id,
            DocumentType = DocumentType.Statement,
            RawText = "Každej hrane štvorstena priradíme jedno reálne číslo.",
            ParsedText = "{}",
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
            RoundInstanceId = ri_2025_csmo_domestic_C.Id,
            Number = 1
        };
        p3.Texts.Add(new ProblemText
        {
            Id = Guid.NewGuid(),
            ProblemId = p3.Id,
            DocumentType = DocumentType.Statement,
            RawText = "Prirodzené číslo zapísané navzájom rôznymi ciframi nazveme pitoreskné.",
            ParsedText = "{}",
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
            RoundInstanceId = ri_2025_csmo_domestic_A.Id,
            Number = 2
        };
        p4.Texts.Add(new ProblemText
        {
            Id = Guid.NewGuid(),
            ProblemId = p4.Id,
            DocumentType = DocumentType.Statement,
            RawText = "Nech p, q sú reálne čísla také, že rovnici |x^2-1|=px+q...",
            ParsedText = "{}",
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
            RoundInstanceId = ri_2024_csmo_domestic_Z9.Id,
            Number = 1
        };
        p5.Texts.Add(new ProblemText
        {
            Id = Guid.NewGuid(),
            ProblemId = p5.Id,
            DocumentType = DocumentType.Statement,
            RawText = "Nájdite všetky dvojice celých čísel x a y takých, že x+y je prvočíslo a 3x+5y je 16.",
            ParsedText = "{}",
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
            RoundInstanceId = ri_2024_csmo_regional_Z9.Id,
            Number = 1
        };
        p6.Texts.Add(new ProblemText
        {
            Id = Guid.NewGuid(),
            ProblemId = p6.Id,
            DocumentType = DocumentType.Statement,
            RawText = "Do divadla dorazili diváci buď peši, autami alebo autobusmi.",
            ParsedText = "{}",
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
            RoundInstanceId = ri_2025_imo.Id,
            Number = 1
        };
        p7.Texts.Add(new ProblemText
        {
            Id = Guid.NewGuid(),
            ProblemId = p7.Id,
            DocumentType = DocumentType.Statement,
            RawText = "Some IMO problem",
            ParsedText = "{}",
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
        // This creates a total of 7 problems with the following distribution:
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

        await context.SaveChangesAsync();
    }
}




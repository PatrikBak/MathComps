using DotNet.Testcontainers.Builders;
using DotNet.Testcontainers.Containers;
using MathComps.Domain.ApiDtos.Helpers;
using MathComps.Domain.ApiDtos.ProblemQuery;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Extensions;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services;
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
        await context.Database.EnsureCreatedAsync();

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
    /// Executes a filter query using the ProblemFilterService and returns the result.
    /// This helper method encapsulates the common pattern of creating a service scope,
    /// executing a filter query, and ensuring proper disposal of resources.
    /// </summary>
    /// <param name="filterQuery">The filter query to execute.</param>
    /// <returns>The filter result from the ProblemFilterService.</returns>
    private async Task<FilterResult> ExecuteFilterQuery(FilterQuery filterQuery)
    {
        // Create a new service provider for each test to ensure proper isolation.
        using var serviceProvider = CreateServiceProvider();
        await using var scope = serviceProvider.CreateAsyncScope();

        // Get the service
        return await scope.ServiceProvider.GetRequiredService<IProblemFilterService>()
            // Execute the filter query
            .FilterAsync(filterQuery);
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
        var initialQuery = new FilterQuery(new FilterParameters(string.Empty, false, [], [], [], [], LogicToggle.Or, [], LogicToggle.Or), 10, 1);

        // Act - execute the filter with no criteria
        var initialResult = await ExecuteFilterQuery(initialQuery);

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
        var textSearchQuery = new FilterQuery(new FilterParameters("štvorstena", false, [], [], [], [], LogicToggle.Or, [], LogicToggle.Or), 10, 1);

        // Act - execute the text search
        var textSearchResult = await ExecuteFilterQuery(textSearchQuery);

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
        var lowercaseQuery = new FilterQuery(new FilterParameters("stvorstena", false, [], [], [], [], LogicToggle.Or, [], LogicToggle.Or), 10, 1);

        // Test 2: UPPERCASE without accents should match "štvorstena" (lowercase with accents)
        var uppercaseQuery = new FilterQuery(new FilterParameters("STVORSTENA", false, [], [], [], [], LogicToggle.Or, [], LogicToggle.Or), 10, 1);

        // Test 3: UPPERCASE without accents should match "Prirodzené" (different case with accents)
        var mixedCaseQuery = new FilterQuery(new FilterParameters("PRIRODZENE", false, [], [], [], [], LogicToggle.Or, [], LogicToggle.Or), 10, 1);

        // Test 4: lowercase without accents should match "Prirodzené" (different case with accents)
        var lowerToTitleQuery = new FilterQuery(new FilterParameters("prirodzene", false, [], [], [], [], LogicToggle.Or, [], LogicToggle.Or), 10, 1);

        // Act - execute all search variations
        var lowercaseResult = await ExecuteFilterQuery(lowercaseQuery);
        var uppercaseResult = await ExecuteFilterQuery(uppercaseQuery);
        var mixedCaseResult = await ExecuteFilterQuery(mixedCaseQuery);
        var lowerToTitleResult = await ExecuteFilterQuery(lowerToTitleQuery);

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
        var authorQuery = new FilterQuery(new FilterParameters(string.Empty, false, [], [], [], [], LogicToggle.Or, ["patrik-bak"], LogicToggle.Or), 10, 1);

        // Act - execute the author filter
        var authorResult = await ExecuteFilterQuery(authorQuery);

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
        var tagsOrQuery = new FilterQuery(new FilterParameters(string.Empty, false, [], [], [], ["algebra", "number-theory"], LogicToggle.Or, [], LogicToggle.Or), 10, 1);

        // Act - execute the OR tag filter
        var tagsOrResult = await ExecuteFilterQuery(tagsOrQuery);

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
        var tagsAndQuery = new FilterQuery(new FilterParameters(string.Empty, false, [], [], [], ["algebra", "number-theory"], LogicToggle.And, [], LogicToggle.Or), 10, 1);

        // Act - execute the AND tag filter
        var tagsAndResult = await ExecuteFilterQuery(tagsAndQuery);

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
        var complexQuery = new FilterQuery(new FilterParameters(string.Empty, false, [75], [], [], ["geometry"], LogicToggle.Or, [], LogicToggle.Or), 10, 1);

        // Act - execute the complex multi-criteria filter
        var complexQueryResult = await ExecuteFilterQuery(complexQuery);

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
        var page1Query = new FilterQuery(new FilterParameters(string.Empty, false, [], [], [], [], LogicToggle.Or, [], LogicToggle.Or), 4, 1);
        var page2Query = new FilterQuery(new FilterParameters(string.Empty, false, [], [], [], [], LogicToggle.Or, [], LogicToggle.Or), 4, 2);

        // Act - execute both page queries
        var page1Result = await ExecuteFilterQuery(page1Query);
        var page2Result = await ExecuteFilterQuery(page2Query);

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
        var noResultsQuery = new FilterQuery(new FilterParameters("non_existent_text_gibrish", false, [], [], [], [], LogicToggle.Or, [], LogicToggle.Or), 10, 1);

        // Act - execute the query that should return no results
        var noResultsResult = await ExecuteFilterQuery(noResultsQuery);

        // Assert - verify we get an empty result set with zero total count
        Assert.Empty(noResultsResult.Problems.Items);
        Assert.Equal(0, noResultsResult.Problems.TotalCount);
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
            SeasonId = season2025.Id
        };
        var ri_2025_csmo_domestic_B = new RoundInstance
        {
            Id = Guid.NewGuid(),
            RoundId = roundCsmoDomesticB.Id,
            SeasonId = season2025.Id
        };
        var ri_2025_csmo_domestic_C = new RoundInstance
        {
            Id = Guid.NewGuid(),
            RoundId = roundCsmoDomesticC.Id,
            SeasonId = season2025.Id
        };
        var ri_2024_csmo_domestic_Z9 = new RoundInstance
        {
            Id = Guid.NewGuid(),
            RoundId = roundCsmoDomesticZ9.Id,
            SeasonId = season2024.Id
        };
        var ri_2024_csmo_regional_Z9 = new RoundInstance
        {
            Id = Guid.NewGuid(),
            RoundId = roundCsmoRegionalZ9.Id,
            SeasonId = season2024.Id
        };
        var ri_2025_imo = new RoundInstance
        {
            Id = Guid.NewGuid(),
            SeasonId = season2025.Id,
            RoundId = roundImo.Id
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
            Statement = "Ostrov je rozdelený na niekoľko kráľovstiev.",
            StatementParsed = "{}",
            RoundInstanceId = ri_2025_csmo_domestic_A.Id,
            Number = 1
        };
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
            Statement = "Každej hrane štvorstena priradíme jedno reálne číslo.",
            StatementParsed = "{}",
            RoundInstanceId = ri_2025_csmo_domestic_B.Id,
            Number = 1
        };
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
            Statement = "Prirodzené číslo zapísané navzájom rôznymi ciframi nazveme pitoreskné.",
            StatementParsed = "{}",
            RoundInstanceId = ri_2025_csmo_domestic_C.Id,
            Number = 1
        };
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
            Statement = "Nech p, q sú reálne čísla také, že rovnici |x^2-1|=px+q...",
            StatementParsed = "{}",
            RoundInstanceId = ri_2025_csmo_domestic_A.Id,
            Number = 2
        };
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
            Statement = "Nájdite všetky dvojice celých čísel x a y takých, že x+y je prvočíslo a 3x+5y je 16.",
            StatementParsed = "{}",
            RoundInstanceId = ri_2024_csmo_domestic_Z9.Id,
            Number = 1
        };
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
            Statement = "Do divadla dorazili diváci buď peši, autami alebo autobusmi.",
            StatementParsed = "{}",
            RoundInstanceId = ri_2024_csmo_regional_Z9.Id,
            Number = 1
        };
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
            Statement = "Some IMO problem",
            StatementParsed = "{}",
            RoundInstanceId = ri_2025_imo.Id,
            Number = 1
        };
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
        await context.SaveChangesAsync();
    }
}



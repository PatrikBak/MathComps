using MathComps.Infrastructure.Tests.TestInfrastructure;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Extensions;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Users;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace MathComps.Infrastructure.Tests.Users;

/// <summary>
/// Integration tests for the EF-backed <see cref="IUserProblemService"/> using a shared PostgreSQL container.
/// Tests both like and mark toggle operations with atomic CTE behavior.
/// </summary>
/// <param name="fixture">The shared PostgreSQL container fixture.</param>
public class UserProblemServicePostgresTests(PostgresContainerFixture fixture)
    : PostgresTestBase<IUserProblemService>(fixture)
{
    /// <inheritdoc/>
    protected override void ConfigureServices(IServiceCollection services) =>
        // Register the user services module the test resolves from
        services.AddUserServices();

    /// <summary>
    /// Test user ID 1.
    /// </summary>
    private static readonly Guid _user1Id = Guid.Parse("00000000-0000-0000-0000-000000000001");

    /// <summary>
    /// Test user ID 2.
    /// </summary>
    private static readonly Guid _user2Id = Guid.Parse("00000000-0000-0000-0000-000000000002");

    /// <summary>
    /// Problem ID 1 — assigned during seed.
    /// </summary>
    private Guid _problem1Id;

    /// <summary>
    /// Problem ID 2 — assigned during seed.
    /// </summary>
    private Guid _problem2Id;

    #region ToggleLikeAsync Tests

    /// <summary>
    /// Verifies the full toggle cycle for likes: create → remove → re-create.
    /// This test ensures that:
    /// 1. A like is created when none exists (first toggle).
    /// 2. The like is removed on second toggle.
    /// 3. The like is re-created on third toggle.
    /// </summary>
    [Fact]
    public Task ToggleLikeCreatesAndRemovesLike() => RunTestAsync(async service =>
    {
        // Act 1: First toggle — should create the like
        await service.ToggleLikeAsync(_user1Id, _problem1Id);

        // Assert 1: Like now exists in the database
        await AssertLikeExistsAsync(_user1Id, _problem1Id, expected: true);

        // Act 2: Second toggle — should remove the like
        await service.ToggleLikeAsync(_user1Id, _problem1Id);

        // Assert 2: Like is no longer in the database
        await AssertLikeExistsAsync(_user1Id, _problem1Id, expected: false);

        // Act 3: Third toggle — should re-create the like
        await service.ToggleLikeAsync(_user1Id, _problem1Id);

        // Assert 3: Like exists again after the third toggle
        await AssertLikeExistsAsync(_user1Id, _problem1Id, expected: true);
    });

    /// <summary>
    /// Verifies that likes are scoped per user — toggling for one user does not affect another.
    /// This test ensures that:
    /// 1. Both users can independently like the same problem.
    /// 2. Removing one user's like leaves the other user's like intact.
    /// </summary>
    [Fact]
    public Task ToggleLikeIsolatedBetweenUsers() => RunTestAsync(async service =>
    {
        // Act — both users like the same problem
        await service.ToggleLikeAsync(_user1Id, _problem1Id);
        await service.ToggleLikeAsync(_user2Id, _problem1Id);

        // Assert — both likes exist independently
        await AssertLikeExistsAsync(_user1Id, _problem1Id, expected: true);
        await AssertLikeExistsAsync(_user2Id, _problem1Id, expected: true);

        // Act — User1 unlikes the problem
        await service.ToggleLikeAsync(_user1Id, _problem1Id);

        // Assert — only User1's like was removed, User2's remains
        await AssertLikeExistsAsync(_user1Id, _problem1Id, expected: false);
        await AssertLikeExistsAsync(_user2Id, _problem1Id, expected: true);
    });

    /// <summary>
    /// Verifies that likes are scoped per problem — a like on one problem doesn't affect another.
    /// This test ensures that:
    /// 1. A user can independently like multiple problems.
    /// 2. Removing a like on one problem leaves the other problem's like intact.
    /// </summary>
    [Fact]
    public Task ToggleLikeIsolatedBetweenProblems() => RunTestAsync(async service =>
    {
        // Act — User1 likes both problems
        await service.ToggleLikeAsync(_user1Id, _problem1Id);
        await service.ToggleLikeAsync(_user1Id, _problem2Id);

        // Assert — both likes exist independently
        await AssertLikeExistsAsync(_user1Id, _problem1Id, expected: true);
        await AssertLikeExistsAsync(_user1Id, _problem2Id, expected: true);

        // Act — unlike only problem1
        await service.ToggleLikeAsync(_user1Id, _problem1Id);

        // Assert — only problem1's like was removed, problem2's remains
        await AssertLikeExistsAsync(_user1Id, _problem1Id, expected: false);
        await AssertLikeExistsAsync(_user1Id, _problem2Id, expected: true);
    });

    #endregion ToggleLikeAsync Tests

    #region ToggleMarkAsync Tests

    /// <summary>
    /// Verifies the full toggle cycle for marks: create → remove → re-create.
    /// This test ensures that:
    /// 1. A mark is created when none exists (first toggle).
    /// 2. The mark is removed on second toggle.
    /// 3. The mark is re-created on third toggle.
    /// </summary>
    [Fact]
    public Task ToggleMarkCreatesAndRemovesMark() => RunTestAsync(async service =>
    {
        // Act 1: First toggle — should create the mark
        await service.ToggleMarkAsync(_user1Id, _problem1Id);

        // Assert 1: Mark now exists in the database
        await AssertMarkExistsAsync(_user1Id, _problem1Id, expected: true);

        // Act 2: Second toggle — should remove the mark
        await service.ToggleMarkAsync(_user1Id, _problem1Id);

        // Assert 2: Mark is no longer in the database
        await AssertMarkExistsAsync(_user1Id, _problem1Id, expected: false);

        // Act 3: Third toggle — should re-create the mark
        await service.ToggleMarkAsync(_user1Id, _problem1Id);

        // Assert 3: Mark exists again after the third toggle
        await AssertMarkExistsAsync(_user1Id, _problem1Id, expected: true);
    });

    /// <summary>
    /// Verifies that marks are scoped per user — toggling for one user does not affect another.
    /// This test ensures that:
    /// 1. Both users can independently mark the same problem.
    /// 2. Removing one user's mark leaves the other user's mark intact.
    /// </summary>
    [Fact]
    public Task ToggleMarkIsolatedBetweenUsers() => RunTestAsync(async service =>
    {
        // Act — both users mark the same problem
        await service.ToggleMarkAsync(_user1Id, _problem1Id);
        await service.ToggleMarkAsync(_user2Id, _problem1Id);

        // Assert — both marks exist independently
        await AssertMarkExistsAsync(_user1Id, _problem1Id, expected: true);
        await AssertMarkExistsAsync(_user2Id, _problem1Id, expected: true);

        // Act — User1 unmarks the problem
        await service.ToggleMarkAsync(_user1Id, _problem1Id);

        // Assert — only User1's mark was removed, User2's remains
        await AssertMarkExistsAsync(_user1Id, _problem1Id, expected: false);
        await AssertMarkExistsAsync(_user2Id, _problem1Id, expected: true);
    });

    /// <summary>
    /// Verifies that likes and marks are completely independent — toggling one does not affect the other.
    /// This test ensures that:
    /// 1. A user can both like and mark the same problem simultaneously.
    /// 2. Removing a like leaves the mark intact.
    /// 3. Removing a mark leaves the like intact (if it exists).
    /// </summary>
    [Fact]
    public Task LikeAndMarkAreIndependent() => RunTestAsync(async service =>
    {
        // Act — like and mark the same problem
        await service.ToggleLikeAsync(_user1Id, _problem1Id);
        await service.ToggleMarkAsync(_user1Id, _problem1Id);

        // Assert — both exist independently
        await AssertLikeExistsAsync(_user1Id, _problem1Id, expected: true);
        await AssertMarkExistsAsync(_user1Id, _problem1Id, expected: true);

        // Act — remove the like only
        await service.ToggleLikeAsync(_user1Id, _problem1Id);

        // Assert — like is gone, mark remains untouched
        await AssertLikeExistsAsync(_user1Id, _problem1Id, expected: false);
        await AssertMarkExistsAsync(_user1Id, _problem1Id, expected: true);

        // Act — remove the mark
        await service.ToggleMarkAsync(_user1Id, _problem1Id);

        // Assert — both are now gone
        await AssertLikeExistsAsync(_user1Id, _problem1Id, expected: false);
        await AssertMarkExistsAsync(_user1Id, _problem1Id, expected: false);
    });

    #endregion ToggleMarkAsync Tests

    #region Helpers

    /// <summary>
    /// Verifies whether a like exists for the given user/problem pair.
    /// Uses a fresh DbContext scope to ensure we read the latest database state,
    /// avoiding any cached data from the service's DbContext.
    /// </summary>
    private async Task AssertLikeExistsAsync(Guid userId, Guid problemId, bool expected)
    {
        // Create a fresh service provider and scope to get a clean DbContext
        await using var serviceProvider = CreateServiceProvider();
        await using var scope = serviceProvider.CreateAsyncScope();
        var context = scope.ServiceProvider.GetRequiredService<MathCompsDbContext>();

        // Query the database directly
        var exists = await context.ProblemLikes
            .AnyAsync(like => like.UserId == userId && like.ProblemId == problemId);

        // Ensure the right existance
        Assert.Equal(expected, exists);
    }

    /// <summary>
    /// Verifies whether a mark exists for the given user/problem pair.
    /// Uses a fresh DbContext scope to ensure we read the latest database state,
    /// avoiding any cached data from the service's DbContext.
    /// </summary>
    private async Task AssertMarkExistsAsync(Guid userId, Guid problemId, bool expected)
    {
        // Create a fresh service provider and scope to get a clean DbContext
        await using var serviceProvider = CreateServiceProvider();
        await using var scope = serviceProvider.CreateAsyncScope();
        var context = scope.ServiceProvider.GetRequiredService<MathCompsDbContext>();

        // Query the database directly
        var exists = await context.ProblemMarkStatuses
            .AnyAsync(markStatus => markStatus.UserId == userId && markStatus.ProblemId == problemId);

        // Ensure the right existance
        Assert.Equal(expected, exists);
    }

    #endregion Helpers

    /// <inheritdoc />
    protected override async Task SeedDataAsync(MathCompsDbContext context)
    {
        // Season — single season is sufficient for toggle tests
        var season = new Season
        {
            Id = Guid.NewGuid(),
            StartYear = 2025,
            EditionNumber = 75
        };
        context.Seasons.Add(season);

        // Competition — CSMO is the domestic competition
        var competition = CompetitionTreeSeed.Root(context, "csmo", 100);

        // Category — category A (highest age group)
        var category = new Category
        {
            Id = Guid.NewGuid(),
            Slug = "a",
            SortOrder = 100
        };
        context.Categories.Add(category);

        // Round — domestic round for category A
        var round = new Round
        {
            Id = Guid.NewGuid(),
            CompetitionId = competition.Id,
            CategoryId = category.Id,
            Slug = "i",
            CompositeSlug = "csmo-a-i",
            SortOrder = 100
        };
        context.Rounds.Add(round);

        // Round instance — season 75, domestic round A
        var roundInstance = new RoundInstance
        {
            Id = Guid.NewGuid(),
            RoundId = round.Id,
            CompetitionId = CompetitionTreeSeed.Chain(context, "csmo-a-i").Id,
            SeasonId = season.Id,
            Date = new DateOnly(2025, 9, 1)
        };
        context.RoundInstances.Add(roundInstance);

        // Problems — two problems are sufficient for isolation tests
        _problem1Id = Guid.NewGuid();
        _problem2Id = Guid.NewGuid();

        context.Problems.Add(new Problem
        {
            Id = _problem1Id,
            Slug = "75-a-i-1",
            RoundInstanceId = roundInstance.Id,
            Number = 1
        });
        context.Problems.Add(new Problem
        {
            Id = _problem2Id,
            Slug = "75-a-i-2",
            RoundInstanceId = roundInstance.Id,
            Number = 2
        });

        // Users — two users for cross-user isolation tests
        context.Users.Add(new User
        {
            Id = _user1Id,
            ExternalId = "user1",
            DisplayName = "User 1",
            Email = "user1@test.com",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        });
        context.Users.Add(new User
        {
            Id = _user2Id,
            ExternalId = "user2",
            DisplayName = "User 2",
            Email = "user2@test.com",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        });

        // No likes or marks are seeded — tests start from a clean slate
        // and create their own state via the service methods being tested

        // Submit changes
        await context.SaveChangesAsync();
    }
}

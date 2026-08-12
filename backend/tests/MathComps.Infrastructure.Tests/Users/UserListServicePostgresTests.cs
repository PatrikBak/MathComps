using MathComps.Infrastructure.Tests.TestInfrastructure;
using MathComps.Domain.Contracts.UserLists;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Extensions;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Problems;
using MathComps.Infrastructure.Services.Users;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace MathComps.Infrastructure.Tests.Users;

/// <summary>
/// Integration tests for the EF-backed <see cref="IUserListService"/> using a shared PostgreSQL container.
/// </summary>
/// <param name="fixture">The shared PostgreSQL container fixture.</param>
public class UserListServicePostgresTests(PostgresContainerFixture fixture)
    : PostgresTestBase<IUserListService>(fixture)
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
    /// Test problem ID (set in SeedDataAsync).
    /// </summary>
    private static Guid _problemId;

    /// <summary>
    /// Second test problem ID (set in SeedDataAsync).
    /// </summary>
    private static Guid _problem2Id;

    /// <summary>
    /// Test problem slug (matches the seeded Problem.Slug).
    /// </summary>
    private const string ProblemSlug = "p1";

    /// <summary>
    /// Second test problem slug (matches the seeded Problem.Slug).
    /// </summary>
    private const string Problem2Slug = "p2";

    /// <summary>
    /// Verifies that GetListsAsync returns empty lists and the correct liked count from seeded data.
    /// </summary>
    [Fact]
    public Task GetListsAsync_ReturnsEmptyListsAndSeededLikedCount() => RunTestAsync(async service =>
    {
        // Act
        var response = await service.GetListsAsync(_user1Id);

        // Assert — no custom lists, but seed data has 1 ProblemLike for user1
        Assert.NotNull(response);
        Assert.Empty(response.Lists);
        Assert.Equal(1, response.LikedCount);
    });

    /// <summary>
    /// Verifies that lists are returned in sort order.
    /// </summary>
    [Fact]
    public Task GetListsAsync_ReturnsListsOrderedBySortOrder() => RunTestAsync(async service =>
    {
        // Arrange — create lists in non-alphabetical order
        await service.CreateListAsync(_user1Id, "Charlie");
        await service.CreateListAsync(_user1Id, "Alpha");
        await service.CreateListAsync(_user1Id, "Bravo");

        // Act
        var response = await service.GetListsAsync(_user1Id);

        // Assert — returned in creation order (sort order 1, 2, 3)
        Assert.Equal(3, response.Lists.Count);
        Assert.Equal("Charlie", response.Lists[0].Name);
        Assert.Equal("Alpha", response.Lists[1].Name);
        Assert.Equal("Bravo", response.Lists[2].Name);
    });

    /// <summary>
    /// Verifies that the liked count reflects ProblemLike records for the user.
    /// </summary>
    [Fact]
    public Task GetListsAsync_ReturnsCorrectLikedCount() => RunTestAsync(async service =>
    {
        // Arrange — seed adds 1 ProblemLike for user1, add another via direct DB access
        using var scope = CreateServiceProvider().CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<MathCompsDbContext>();
        context.ProblemLikes.Add(new ProblemLike
        {
            UserId = _user1Id,
            ProblemId = _problem2Id,
            CreatedAt = DateTimeOffset.UtcNow
        });
        await context.SaveChangesAsync();

        // Act — user1 has 2 likes total (1 seeded + 1 added above)
        var response = await service.GetListsAsync(_user1Id);

        // Assert
        Assert.Equal(2, response.LikedCount);
    });

    /// <summary>
    /// Verifies that problem counts are correctly calculated for each list.
    /// </summary>
    [Fact]
    public Task GetListsAsync_ReturnsCorrectProblemCounts() => RunTestAsync(async service =>
    {
        // Arrange
        var list = await service.CreateListAsync(_user1Id, "Test List");
        await service.AddProblemAsync(_user1Id, list.ContentId, ProblemSlug);
        await service.AddProblemAsync(_user1Id, list.ContentId, Problem2Slug);

        // Act
        var response = await service.GetListsAsync(_user1Id);

        // Assert
        Assert.Single(response.Lists);
        Assert.Equal(2, response.Lists[0].ProblemCount);
    });

    /// <summary>
    /// Verifies that user2's lists do not appear in user1's response.
    /// </summary>
    [Fact]
    public Task GetListsAsync_IsolatesBetweenUsers() => RunTestAsync(async service =>
    {
        // Arrange
        await service.CreateListAsync(_user1Id, "User1 List");
        await service.CreateListAsync(_user2Id, "User2 List");

        // Act
        var response1 = await service.GetListsAsync(_user1Id);
        var response2 = await service.GetListsAsync(_user2Id);

        // Assert — each user sees only their own list
        Assert.Single(response1.Lists);
        Assert.Equal("User1 List", response1.Lists[0].Name);
        Assert.Single(response2.Lists);
        Assert.Equal("User2 List", response2.Lists[0].Name);
    });

    /// <summary>
    /// Verifies that subsequent lists get auto-incremented sort orders.
    /// </summary>
    [Fact]
    public Task CreateListAsync_AutoIncrementsSortOrder() => RunTestAsync(async service =>
    {
        // Act
        await service.CreateListAsync(_user1Id, "First");
        await service.CreateListAsync(_user1Id, "Second");

        // Assert — verify via GetListsAsync (returns ordered by sort order)
        var response = await service.GetListsAsync(_user1Id);
        Assert.Equal(2, response.Lists.Count);
        Assert.Equal("First", response.Lists[0].Name);
        Assert.Equal("Second", response.Lists[1].Name);
    });

    /// <summary>
    /// Verifies that whitespace is trimmed from list names.
    /// </summary>
    [Fact]
    public Task CreateListAsync_TrimsWhitespace() => RunTestAsync(async service =>
    {
        // Act
        var list = await service.CreateListAsync(_user1Id, "  My List  ");

        // Assert
        Assert.Equal("My List", list.Name);
    });

    /// <summary>
    /// Verifies that each list gets a unique ContentId.
    /// </summary>
    [Fact]
    public Task CreateListAsync_GeneratesUniqueContentIds() => RunTestAsync(async service =>
    {
        // Act
        var list1 = await service.CreateListAsync(_user1Id, "List A");
        var list2 = await service.CreateListAsync(_user1Id, "List B");

        // Assert
        Assert.NotEqual(list1.ContentId, list2.ContentId);
        Assert.NotEmpty(list1.ContentId);
        Assert.NotEmpty(list2.ContentId);
    });

    /// <summary>
    /// Verifies that renaming a list changes its name but keeps the ContentId stable.
    /// </summary>
    [Fact]
    public Task UpdateListAsync_RenamesKeepingContentIdStable() => RunTestAsync(async service =>
    {
        // Arrange
        var created = await service.CreateListAsync(_user1Id, "Original Name");

        // Act
        var updated = await service.UpdateListAsync(_user1Id, created.ContentId, "New Name");

        // Assert
        Assert.Equal("New Name", updated.Name);
        Assert.Equal(created.ContentId, updated.ContentId);
    });

    /// <summary>
    /// Verifies that updating a non-existent list throws.
    /// </summary>
    [Fact]
    public Task UpdateListAsync_ThrowsWhenListNotFound() => RunTestAsync(async service =>
    {
        // Act & Assert - the missing list is reported
        await Assert.ThrowsAsync<ListNotFoundException>(
            () => service.UpdateListAsync(_user1Id, "nonexistent", "Name"));
    });

    /// <summary>
    /// Verifies that deleting a list removes it and cascade deletes its items.
    /// </summary>
    [Fact]
    public Task DeleteListAsync_DeletesListAndCascadesItems() => RunTestAsync(async service =>
    {
        // Arrange
        var list = await service.CreateListAsync(_user1Id, "To Delete");
        await service.AddProblemAsync(_user1Id, list.ContentId, ProblemSlug);

        // Act
        await service.DeleteListAsync(_user1Id, list.ContentId);

        // Assert — list is gone
        var response = await service.GetListsAsync(_user1Id);
        Assert.Empty(response.Lists);

        // Assert — items are cascade deleted
        using var scope = CreateServiceProvider().CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<MathCompsDbContext>();
        var itemCount = await context.UserProblemListItems.CountAsync();
        Assert.Equal(0, itemCount);
    });

    /// <summary>
    /// Verifies that deleting a non-existent list throws.
    /// </summary>
    [Fact]
    public Task DeleteListAsync_ThrowsWhenListNotFound() => RunTestAsync(async service =>
    {
        // Act & Assert - the missing list is reported
        await Assert.ThrowsAsync<ListNotFoundException>(
            () => service.DeleteListAsync(_user1Id, "nonexistent"));
    });

    /// <summary>
    /// Verifies that adding and removing a problem works and updates the count.
    /// </summary>
    [Fact]
    public Task AddAndRemoveProblem_UpdatesCount() => RunTestAsync(async service =>
    {
        // Arrange
        var list = await service.CreateListAsync(_user1Id, "Test");

        // Act 1 — add
        await service.AddProblemAsync(_user1Id, list.ContentId, ProblemSlug);

        // Assert 1
        var response1 = await service.GetListsAsync(_user1Id);
        Assert.Equal(1, response1.Lists[0].ProblemCount);

        // Act 2 — remove
        await service.RemoveProblemAsync(_user1Id, list.ContentId, ProblemSlug);

        // Assert 2
        var response2 = await service.GetListsAsync(_user1Id);
        Assert.Equal(0, response2.Lists[0].ProblemCount);
    });

    /// <summary>
    /// Verifies that adding a non-existent problem throws a not-found error.
    /// </summary>
    [Fact]
    public Task AddProblemAsync_ThrowsWhenProblemMissing() => RunTestAsync(async service =>
    {
        // Arrange
        var list = await service.CreateListAsync(_user1Id, "Test");

        // Act & Assert - the missing problem is reported
        await Assert.ThrowsAsync<ProblemNotFoundException>(
            () => service.AddProblemAsync(_user1Id, list.ContentId, "no-such-problem"));
    });

    /// <summary>
    /// Verifies that adding the same problem twice is idempotent (no duplicate, no error).
    /// </summary>
    [Fact]
    public Task AddProblemAsync_IsIdempotent() => RunTestAsync(async service =>
    {
        // Arrange
        var list = await service.CreateListAsync(_user1Id, "Test");

        // Act — add same problem twice
        await service.AddProblemAsync(_user1Id, list.ContentId, ProblemSlug);
        await service.AddProblemAsync(_user1Id, list.ContentId, ProblemSlug);

        // Assert — count is 1, not 2
        var response = await service.GetListsAsync(_user1Id);
        Assert.Equal(1, response.Lists[0].ProblemCount);
    });

    // ─── ReorderListsAsync ──────────────────────────────────────────────

    /// <summary>
    /// Verifies that reordering changes the sort order of lists.
    /// </summary>
    [Fact]
    public Task ReorderListsAsync_ReordersCorrectly() => RunTestAsync(async service =>
    {
        // Arrange — create 3 lists (sort order: 1, 2, 3)
        var a = await service.CreateListAsync(_user1Id, "A");
        var b = await service.CreateListAsync(_user1Id, "B");
        var c = await service.CreateListAsync(_user1Id, "C");

        // Act — reorder to C, A, B
        await service.ReorderListsAsync(_user1Id, [c.ContentId, a.ContentId, b.ContentId]);

        // Assert
        var response = await service.GetListsAsync(_user1Id);
        Assert.Equal(3, response.Lists.Count);
        Assert.Equal("C", response.Lists[0].Name);
        Assert.Equal("A", response.Lists[1].Name);
        Assert.Equal("B", response.Lists[2].Name);
    });

    /// <summary>
    /// Verifies that reordering with mismatched content IDs throws.
    /// </summary>
    [Fact]
    public Task ReorderListsAsync_ThrowsOnMismatchedContentIds() => RunTestAsync(async service =>
    {
        // Arrange
        await service.CreateListAsync(_user1Id, "A");

        // Act & Assert - the mismatch is reported
        await Assert.ThrowsAsync<ListReorderMismatchException>(
            () => service.ReorderListsAsync(_user1Id, ["wrong-id"]));
    });

    /// <inheritdoc />
    protected override async Task SeedDataAsync(MathCompsDbContext context)
    {
        // Create test users
        context.Users.Add(new User
        {
            Id = _user1Id,
            ExternalId = "user1",
            DisplayName = "User 1",
            Email = "user1@example.com",
            AvatarUrl = null,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        });
        context.Users.Add(new User
        {
            Id = _user2Id,
            ExternalId = "user2",
            DisplayName = "User 2",
            Email = "user2@example.com",
            AvatarUrl = null,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        });

        // Create Competition → Season → Round → RoundInstance → Problem chain
        var competition = CompetitionTreeSeed.Root(context, "testcomp", 1);

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
            Slug = "testround",
            CompositeSlug = "testcomp-testround",
            SortOrder = 1,
            IsDefault = false
        };
        context.Rounds.Add(round);

        var roundInstance = new RoundInstance
        {
            Id = Guid.NewGuid(),
            RoundId = round.Id,
            CompetitionId = CompetitionTreeSeed.Chain(context, "testcomp-testround").Id,
            SeasonId = season.Id,
            Date = DateOnly.FromDateTime(DateTime.Today)
        };
        context.RoundInstances.Add(roundInstance);

        // Problem 1
        var problem1 = new Problem
        {
            RoundInstanceId = roundInstance.Id,
            Number = 1,
            Slug = "p1"
        };
        context.Problems.Add(problem1);

        // Problem 2
        var problem2 = new Problem
        {
            RoundInstanceId = roundInstance.Id,
            Number = 2,
            Slug = "p2"
        };
        context.Problems.Add(problem2);

        // Save to generate IDs
        await context.SaveChangesAsync();

        // Store problem IDs for tests
        _problemId = problem1.Id;
        _problem2Id = problem2.Id;

        // Seed one ProblemLike for user1 (used by GetListsAsync_ReturnsCorrectLikedCount)
        context.ProblemLikes.Add(new ProblemLike
        {
            UserId = _user1Id,
            ProblemId = _problemId,
            CreatedAt = DateTimeOffset.UtcNow
        });

        await context.SaveChangesAsync();
    }
    #region Sharing Tests

    /// <summary>
    /// Verifies that SetSharingAsync enables sharing and returns the updated DTO.
    /// </summary>
    [Fact]
    public Task SetSharingAsync_EnablesSharing() => RunTestAsync(async service =>
    {
        // Arrange — create a list
        var list = await service.CreateListAsync(_user1Id, "Shared List");
        Assert.False(list.IsShared);

        // Act — enable sharing
        var updated = await service.SetSharingAsync(_user1Id, list.ContentId, enabled: true);

        // Assert
        Assert.True(updated.IsShared);
        Assert.Equal(list.ContentId, updated.ContentId);
    });

    /// <summary>
    /// Verifies that SetSharingAsync disables sharing after being enabled.
    /// </summary>
    [Fact]
    public Task SetSharingAsync_DisablesSharing() => RunTestAsync(async service =>
    {
        // Arrange — create and share a list
        var list = await service.CreateListAsync(_user1Id, "Shared List");
        await service.SetSharingAsync(_user1Id, list.ContentId, enabled: true);

        // Act — disable sharing
        var updated = await service.SetSharingAsync(_user1Id, list.ContentId, enabled: false);

        // Assert
        Assert.False(updated.IsShared);
    });

    /// <summary>
    /// Verifies that enabling sharing is idempotent (no error on double enable).
    /// </summary>
    [Fact]
    public Task SetSharingAsync_IsIdempotent() => RunTestAsync(async service =>
    {
        // Arrange — create and share a list
        var list = await service.CreateListAsync(_user1Id, "Shared List");
        await service.SetSharingAsync(_user1Id, list.ContentId, enabled: true);

        // Act — enable sharing again
        var updated = await service.SetSharingAsync(_user1Id, list.ContentId, enabled: true);

        // Assert — still shared, no error
        Assert.True(updated.IsShared);
    });

    /// <summary>
    /// Verifies that SetSharingAsync throws when the list doesn't exist.
    /// </summary>
    [Fact]
    public Task SetSharingAsync_ThrowsWhenListNotFound() => RunTestAsync(async service =>
    {
        // Act & Assert - the missing list is reported
        await Assert.ThrowsAsync<ListNotFoundException>(
            () => service.SetSharingAsync(_user1Id, "nonexistent", enabled: true));
    });

    /// <summary>
    /// Verifies that GetListsAsync returns the correct IsShared flag.
    /// </summary>
    [Fact]
    public Task GetListsAsync_ReturnsIsSharedFlag() => RunTestAsync(async service =>
    {
        // Arrange — create two lists, share only one
        var list1 = await service.CreateListAsync(_user1Id, "Shared");
        var list2 = await service.CreateListAsync(_user1Id, "Private");
        await service.SetSharingAsync(_user1Id, list1.ContentId, enabled: true);

        // Act
        var response = await service.GetListsAsync(_user1Id);

        // Assert
        var shared = response.Lists.First(l => l.ContentId == list1.ContentId);
        var priv = response.Lists.First(l => l.ContentId == list2.ContentId);
        Assert.True(shared.IsShared);
        Assert.False(priv.IsShared);
    });

    /// <summary>
    /// Verifies that CheckListAccessAsync returns HasAccess for the owner.
    /// </summary>
    [Fact]
    public Task CheckListAccessAsync_OwnerHasAccess() => RunTestAsync(async service =>
    {
        // Arrange — create a private list
        var list = await service.CreateListAsync(_user1Id, "My List");

        // Act
        var access = await service.CheckListAccessAsync(_user1Id, list.ContentId);

        // Assert — owner always has access and sees the list name
        Assert.Equal(ListAccessStatus.HasAccess, access.Status);
        Assert.Equal("My List", access.ListName);
    });

    /// <summary>
    /// Verifies that CheckListAccessAsync returns HasAccess for a shared list accessed by another user.
    /// </summary>
    [Fact]
    public Task CheckListAccessAsync_SharedListAccessibleByOthers() => RunTestAsync(async service =>
    {
        // Arrange — create and share a list
        var list = await service.CreateListAsync(_user1Id, "Shared List");
        await service.SetSharingAsync(_user1Id, list.ContentId, enabled: true);

        // Act — another user checks access
        var access = await service.CheckListAccessAsync(_user2Id, list.ContentId);

        // Assert — another user can access and sees the list name
        Assert.Equal(ListAccessStatus.HasAccess, access.Status);
        Assert.Equal("Shared List", access.ListName);
    });

    /// <summary>
    /// Verifies that CheckListAccessAsync returns HasAccess for anonymous access to a shared list.
    /// </summary>
    [Fact]
    public Task CheckListAccessAsync_SharedListAccessibleAnonymously() => RunTestAsync(async service =>
    {
        // Arrange — create and share a list
        var list = await service.CreateListAsync(_user1Id, "Shared List");
        await service.SetSharingAsync(_user1Id, list.ContentId, enabled: true);

        // Act — anonymous access (null userId)
        var access = await service.CheckListAccessAsync(null, list.ContentId);

        // Assert — anonymous can access and sees the list name
        Assert.Equal(ListAccessStatus.HasAccess, access.Status);
        Assert.Equal("Shared List", access.ListName);
    });

    /// <summary>
    /// Verifies that CheckListAccessAsync returns NoAccess for a private list accessed by another user.
    /// </summary>
    [Fact]
    public Task CheckListAccessAsync_PrivateListDeniesOthers() => RunTestAsync(async service =>
    {
        // Arrange — create a private list
        var list = await service.CreateListAsync(_user1Id, "Private List");

        // Act — another user checks access
        var access = await service.CheckListAccessAsync(_user2Id, list.ContentId);

        // Assert — no access, no name
        Assert.Equal(ListAccessStatus.NoAccess, access.Status);
        Assert.Null(access.ListName);
    });

    /// <summary>
    /// Verifies that CheckListAccessAsync returns NotFound for a non-existent list.
    /// </summary>
    [Fact]
    public Task CheckListAccessAsync_ReturnsNotFoundForMissingList() => RunTestAsync(async service =>
    {
        // Act
        var access = await service.CheckListAccessAsync(_user1Id, "nonexistent");

        // Assert — not found, no name
        Assert.Equal(ListAccessStatus.NotFound, access.Status);
        Assert.Null(access.ListName);
    });

    #endregion Sharing Tests
}

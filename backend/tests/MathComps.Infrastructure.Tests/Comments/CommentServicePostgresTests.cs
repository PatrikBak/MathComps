using MathComps.Infrastructure.Tests.TestInfrastructure;
using MathComps.Domain.Contracts.Comments;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Extensions;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Comments;
using Microsoft.EntityFrameworkCore;
using System.Collections.Immutable;
using Microsoft.Extensions.DependencyInjection;

namespace MathComps.Infrastructure.Tests.Comments;

/// <summary>
/// Integration tests for the EF-backed <see cref="ICommentService"/> using a shared PostgreSQL container.
/// </summary>
/// <param name="fixture">The shared PostgreSQL container fixture.</param>
public class CommentServicePostgresTests(PostgresContainerFixture fixture)
    : PostgresTestBase<ICommentService>(fixture)
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
    /// Test user external ID 1.
    /// </summary>
    private static readonly string _user1ExternalId = "user1";

    /// <summary>
    /// Test user external ID 2.
    /// </summary>
    private static readonly string _user2ExternalId = "user2";

    /// <summary>
    /// Test handout content id.
    /// </summary>
    private static readonly string _testHandoutId = "test-handout";

    /// <summary>
    /// Test news article content id.
    /// </summary>
    private static readonly string _testNewsId = "test-news";

    /// <summary>
    /// Test problem slug.
    /// </summary>
    private static readonly string _testProblemSlug = "p1";

    /// <summary>
    /// Test avatar URL for user 1.
    /// </summary>
    private static readonly string _user1AvatarUrl = "https://example.com/avatars/user1.png";

    /// <summary>
    /// Verifies that GetCommentsAsync returns an empty list when no comments exist.
    /// </summary>
    [Fact]
    public Task GetCommentsAsync_ReturnsEmptyListWhenNoComments() => RunTestAsync(async commentService =>
    {
        // Act
        var response = await commentService.GetCommentsAsync(
            new CommentTarget(CommentTargetType.Handout, _testHandoutId),
            _user1Id
        );

        // Assert
        Assert.NotNull(response);
        Assert.Empty(response);
    });

    /// <summary>
    /// Verifies that GetCommentsAsync works with a null viewer ID (anonymous access).
    /// </summary>
    [Fact]
    public Task GetCommentsAsync_AllowsNullViewerId() => RunTestAsync(async commentService =>
    {
        // Create a comment
        await commentService.CreateCommentAsync(
            new CommentTarget(CommentTargetType.Handout, _testHandoutId),
            _user1Id,
            "Public comment"
        );

        // Act
        var response = await commentService.GetCommentsAsync(
            new CommentTarget(CommentTargetType.Handout, _testHandoutId),
            null
        );

        // Assert
        Assert.NotNull(response);
        Assert.Single(response);
        Assert.Equal("Public comment", response[0].Content);
        Assert.False(response[0].IsLiked);
    });

    /// <summary>
    /// A comment is signed with the name its author chose, not the one Clerk supplied. The two projections that
    /// name an author are written separately, one in LINQ for the comment just created and one in raw SQL for
    /// the thread read back, so both are asserted here: a fix applied to one and not the other renames a
    /// student's comment the moment the page reloads.
    /// </summary>
    [Fact]
    public Task CommentsAreSignedWithTheUsername() => RunTestAsync(async commentService =>
    {
        // The author has taken a name of their own
        await QueryAsync(async context =>
        {
            var user = await context.Users.SingleAsync(user => user.Id == _user1Id);
            user.Username = "Peťo Novák";
            await context.SaveChangesAsync();
        });

        // Who writes something
        var created = await commentService.CreateCommentAsync(
            new CommentTarget(CommentTargetType.Handout, _testHandoutId), _user1Id, "Signed.");

        // The comment comes back carrying it
        Assert.Equal("Peťo Novák", created.Author.Name);

        // And so does the thread it lands in
        var thread = await commentService.GetCommentsAsync(
            new CommentTarget(CommentTargetType.Handout, _testHandoutId), _user1Id);
        Assert.Equal("Peťo Novák", thread[0].Author.Name);
    });

    /// <summary>
    /// A deleted account stops being named. Deleting anonymizes the display name and deliberately leaves the
    /// username standing, since the name stays reserved for good, so the projection is the only thing keeping
    /// somebody who asked to be gone from still signing every comment they ever wrote.
    /// </summary>
    [Fact]
    public Task GetCommentsAsync_DoesNotNameADeletedAuthorByTheirUsername() => RunTestAsync(async commentService =>
    {
        // An author with a name of their own
        await QueryAsync(async context =>
        {
            var user = await context.Users.SingleAsync(user => user.Id == _user1Id);
            user.Username = "Peťo Novák";
            await context.SaveChangesAsync();
        });

        // Who writes something and then leaves, anonymized the way deletion anonymizes
        await commentService.CreateCommentAsync(
            new CommentTarget(CommentTargetType.Handout, _testHandoutId), _user1Id, "Written before leaving.");
        await QueryAsync(async context =>
        {
            var user = await context.Users.SingleAsync(user => user.Id == _user1Id);
            user.DisplayName = "Deleted User";
            user.IsDeleted = true;
            await context.SaveChangesAsync();
        });

        // The comment stands, signed by nobody in particular
        var thread = await commentService.GetCommentsAsync(
            new CommentTarget(CommentTargetType.Handout, _testHandoutId), null);
        Assert.Equal("Deleted User", thread[0].Author.Name);
    });

    /// <summary>
    /// Verifies that creating a top-level comment works and can be retrieved.
    /// </summary>
    [Fact]
    public Task CreateCommentAsync_CreatesTopLevelComment() => RunTestAsync(async commentService =>
    {
        // Arrange
        var content = "This is a test comment.";

        // Act
        var createdComment = await commentService.CreateCommentAsync(
            new CommentTarget(CommentTargetType.Handout, _testHandoutId),
            _user1Id,
            content
        );

        // Assert
        Assert.NotNull(createdComment);
        Assert.Equal(content, createdComment.Content);
        Assert.Equal(_user1ExternalId, createdComment.Author.Id);
        Assert.Equal("User 1", createdComment.Author.Name);
        Assert.Equal(_user1AvatarUrl, createdComment.Author.AvatarUrl);
        Assert.Empty(createdComment.Replies);
        Assert.False(createdComment.IsDeleted);
        Assert.Equal(0, createdComment.LikeCount);
        Assert.False(createdComment.IsLiked);

        // Fetch comments to verify
        var response = await commentService.GetCommentsAsync(
            new CommentTarget(CommentTargetType.Handout, _testHandoutId),
            _user1Id
        );

        // Assert
        Assert.Single(response);
        Assert.Equal(content, response[0].Content);
    });

    /// <summary>
    /// Verifies that creating a comment works (Note: Replies are currently not supported by the interface).
    /// </summary>
    [Fact]
    public Task CreateCommentAsync_CreatesComment() => RunTestAsync(async commentService =>
    {
        // Create comment
        var comment = await commentService.CreateCommentAsync(
            new CommentTarget(CommentTargetType.Handout, _testHandoutId),
            _user1Id,
            "Test comment"
        );

        // Assert
        Assert.NotNull(comment);
        Assert.Equal("Test comment", comment.Content);
        Assert.Equal(_user1ExternalId, comment.Author.Id);

        // Fetch comments to verify
        var response = await commentService.GetCommentsAsync(
            new CommentTarget(CommentTargetType.Handout, _testHandoutId),
            _user1Id
        );

        // Assert
        Assert.Single(response);
    });

    /// <summary>
    /// Verifies that toggling a like adds and removes likes correctly.
    /// </summary>
    [Fact]
    public Task ToggleLikeAsync_AddsAndRemovesLike() => RunTestAsync(async commentService =>
    {
        // Create comment
        var comment = await commentService.CreateCommentAsync(
            new CommentTarget(CommentTargetType.Handout, _testHandoutId),
            _user1Id,
            "Test comment");

        // Act 1 - add like
        await commentService.ToggleLikeAsync(comment.Id, _user2Id);

        // Assert 1 - like is added
        var response1 = await commentService.GetCommentsAsync(
            new CommentTarget(CommentTargetType.Handout, _testHandoutId),
            _user2Id
        );
        Assert.Equal(1, response1[0].LikeCount);
        Assert.True(response1[0].IsLiked);

        // Act 2 - remove like
        await commentService.ToggleLikeAsync(comment.Id, _user2Id);

        // Assert 2 - like is removed
        var response2 = await commentService.GetCommentsAsync(
            new CommentTarget(CommentTargetType.Handout, _testHandoutId),
            _user2Id
        );
        Assert.Equal(0, response2[0].LikeCount);
        Assert.False(response2[0].IsLiked);
    });

    /// <summary>
    /// Verifies that a user cannot like their own comment.
    /// </summary>
    [Fact]
    public Task ToggleLikeAsync_ThrowsWhenLikingOwnComment() => RunTestAsync(async commentService =>
    {
        // Create comment
        var comment = await commentService.CreateCommentAsync(
            new CommentTarget(CommentTargetType.Handout, _testHandoutId),
            _user1Id,
            "Test comment");

        // Act & Assert - liking your own comment is rejected
        await Assert.ThrowsAsync<CannotLikeOwnCommentException>(
            () => commentService.ToggleLikeAsync(comment.Id, _user1Id));
    });

    /// <summary>
    /// Verifies that liking a non-existent comment throws a not-found error.
    /// </summary>
    [Fact]
    public Task ToggleLikeAsync_ThrowsWhenCommentMissing() => RunTestAsync(async commentService =>
    {
        // Act & Assert - the missing comment is reported
        await Assert.ThrowsAsync<CommentNotFoundException>(
            () => commentService.ToggleLikeAsync(Guid.NewGuid(), _user1Id));
    });

    /// <summary>
    /// Verifies that deleting a comment sets IsDeleted flag.
    /// </summary>
    [Fact]
    public Task DeleteCommentAsync_SoftDeletesComment() => RunTestAsync(async commentService =>
    {
        // Create comment
        var comment = await commentService.CreateCommentAsync(
            new CommentTarget(CommentTargetType.Handout, _testHandoutId),
            _user1Id,
            "Test comment");

        // Act
        await commentService.DeleteCommentAsync(comment.Id, _user1Id);

        // Fetch comments to verify
        var response = await commentService.GetCommentsAsync(
            new CommentTarget(CommentTargetType.Handout, _testHandoutId),
            _user1Id
        );

        // Assert
        Assert.Single(response);
        Assert.True(response[0].IsDeleted);
    });

    /// <summary>
    /// Verifies that only the author can delete their comment.
    /// </summary>
    [Fact]
    public Task DeleteCommentAsync_ThrowsWhenNotAuthor() => RunTestAsync(async commentService =>
    {
        // Create comment
        var comment = await commentService.CreateCommentAsync(
            new CommentTarget(CommentTargetType.Handout, _testHandoutId),
            _user1Id,
            "Test comment");

        // Act & Assert - the non-author is rejected
        await Assert.ThrowsAsync<NotCommentAuthorException>(
            () => commentService.DeleteCommentAsync(comment.Id, _user2Id));
    });

    /// <summary>
    /// Verifies that creating a reply works and creates the correct hierarchy.
    /// </summary>
    [Fact]
    public Task CreateCommentAsync_CreatesReply() => RunTestAsync(async commentService =>
    {
        // Create parent comment
        var parent = await commentService.CreateCommentAsync(
            new CommentTarget(CommentTargetType.Handout, _testHandoutId),
            _user1Id,
            "Parent comment"
        );

        // Create reply
        var reply = await commentService.CreateCommentAsync(
            new CommentTarget(CommentTargetType.Handout, _testHandoutId),
            _user2Id,
            "Reply comment",
            parent.Id
        );

        // Assert
        Assert.NotNull(reply);
        Assert.Equal("Reply comment", reply.Content);

        // Fetch comments to verify structure
        var response = await commentService.GetCommentsAsync(
            new CommentTarget(CommentTargetType.Handout, _testHandoutId),
            _user1Id
        );

        // Assert
        Assert.Single(response);
        Assert.Equal(parent.Id, response[0].Id);
        Assert.Single(response[0].Replies);
        Assert.Equal(reply.Id, response[0].Replies[0].Id);
        Assert.Equal("Reply comment", response[0].Replies[0].Content);
    });

    /// <summary>
    /// Verifies that creating a complex threaded discussion works correctly.
    /// Hierarchy:
    /// - Root 1 (User 1)
    ///   - Reply 1.1 (User 2)
    ///     - Reply 1.1.1 (User 1)
    ///   - Reply 1.2 (User 1)
    /// - Root 2 (User 2)
    ///   - Reply 2.1 (User 1)
    /// </summary>
    [Fact]
    public Task GetCommentsAsync_HandlesComplexDiscussionThreads() => RunTestAsync(async commentService =>
    {
        // Arrange
        var target = new CommentTarget(CommentTargetType.Handout, _testHandoutId);

        // --- Root 1 Branch ---
        var root1 = await commentService.CreateCommentAsync(target, _user1Id, "Root 1");

        // Reply 1.1 -> Root 1
        var reply1_1 = await commentService.CreateCommentAsync(target, _user2Id, "Reply 1.1", root1.Id);

        // Reply 1.1.1 -> Reply 1.1
        await commentService.CreateCommentAsync(target, _user1Id, "Reply 1.1.1", reply1_1.Id);

        // Reply 1.2 -> Root 1
        var reply1_2 = await commentService.CreateCommentAsync(target, _user1Id, "Reply 1.2", root1.Id);

        // --- Root 2 Branch ---
        var root2 = await commentService.CreateCommentAsync(target, _user2Id, "Root 2");

        // Reply 2.1 -> Root 2
        await commentService.CreateCommentAsync(target, _user1Id, "Reply 2.1", root2.Id);


        // --- Retrieval & Verification ---
        var response = await commentService.GetCommentsAsync(target, _user1Id);

        // Expect 2 top-level comments
        Assert.Equal(2, response.Count);

        // Verify Root 1
        var root1Dto = response.Single(c => c.Id == root1.Id);
        Assert.Equal("Root 1", root1Dto.Content);
        Assert.Equal(2, root1Dto.Replies.Count);

        // Verify Reply 1.1
        var reply1_1Dto = root1Dto.Replies.Single(c => c.Id == reply1_1.Id);
        Assert.Equal("Reply 1.1", reply1_1Dto.Content);
        Assert.Equal(_user2ExternalId, reply1_1Dto.Author.Id);
        Assert.Single(reply1_1Dto.Replies);

        // Verify Reply 1.1.1
        var reply1_1_1Dto = reply1_1Dto.Replies[0];
        Assert.Equal("Reply 1.1.1", reply1_1_1Dto.Content);
        Assert.Equal(_user1ExternalId, reply1_1_1Dto.Author.Id);
        Assert.Empty(reply1_1_1Dto.Replies);

        // Verify Reply 1.2
        var reply1_2Dto = root1Dto.Replies.Single(c => c.Id == reply1_2.Id);
        Assert.Equal("Reply 1.2", reply1_2Dto.Content);
        Assert.Equal(_user1ExternalId, reply1_2Dto.Author.Id);
        Assert.Empty(reply1_2Dto.Replies);

        // Verify Root 2
        var root2Dto = response.Single(c => c.Id == root2.Id);
        Assert.Equal("Root 2", root2Dto.Content);
        Assert.Single(root2Dto.Replies);

        // Verify Reply 2.1
        var reply2_1Dto = root2Dto.Replies[0];
        Assert.Equal("Reply 2.1", reply2_1Dto.Content);
        Assert.Empty(reply2_1Dto.Replies);
    });

    /// <summary>
    /// Verifies that updating a comment changes its content and that 
    /// we have created a new version of the comment.
    /// </summary>
    [Fact]
    public Task UpdateCommentAsync_UpdatesContent() => RunTestAsync(async commentService =>
    {
        // Arrange
        var target = new CommentTarget(CommentTargetType.Handout, _testHandoutId);

        // Create comment
        var comment = await commentService.CreateCommentAsync(
            target,
            _user1Id,
            "Original content"
        );

        // Act - update
        var result = await commentService.UpdateCommentAsync(target, comment.Id, _user1Id, "Updated content");

        // Assert result
        Assert.NotEqual(comment.Id, result.Id);
        Assert.NotNull(result.EditedAt);

        // Verify via fetch
        var response = await commentService.GetCommentsAsync(target, _user1Id);

        // Assert 
        Assert.Single(response);
        Assert.Equal(result.Id, response[0].Id);
        Assert.Equal("Updated content", response[0].Content);
        // Truncate to microseconds (PostgreSQL's precision) for comparison
        Assert.Equal(
            result.EditedAt.TruncateToMicroseconds(),
            response[0].EditedAt!.Value.TruncateToMicroseconds());
    });

    /// <summary>
    /// Verifies that only the author can update a comment.
    /// </summary>
    [Fact]
    public Task UpdateCommentAsync_ThrowsWhenNotAuthor() => RunTestAsync(async commentService =>
    {
        // Arrange
        var target = new CommentTarget(CommentTargetType.Handout, _testHandoutId);

        // Create comment
        var comment = await commentService.CreateCommentAsync(
            target,
            _user1Id,
            "Original content"
        );

        // Act & Assert - the non-author is rejected
        await Assert.ThrowsAsync<NotCommentAuthorException>(
            () => commentService.UpdateCommentAsync(target, comment.Id, _user2Id, "Hacked content"));
    });

    /// <summary>
    /// Verifies that Handouts and NewsArticles are created automatically when referenced.
    /// </summary>
    [Fact]
    public Task CreateCommentAsync_AutoCreatesHandoutAndNewsArticleAnchors() => RunTestAsync(async commentService =>
    {
        // Arrange
        var newHandoutId = "brand-new-handout";
        var newNewsId = "brand-new-news";

        // 1. Create comment on brand new handout
        await commentService.CreateCommentAsync(
            new CommentTarget(CommentTargetType.Handout, newHandoutId), _user1Id, "handout comm");

        // 2. Create comment on brand new news
        await commentService.CreateCommentAsync(
            new CommentTarget(CommentTargetType.News, newNewsId), _user1Id, "news comm");

        // Verify they were created in DB
        using var scope = CreateServiceProvider().CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<MathCompsDbContext>();
        Assert.True(await context.Handouts.AnyAsync(handout => handout.ContentId == newHandoutId), "Handout anchor should be created");
        Assert.True(await context.NewsArticles.AnyAsync(news => news.ContentId == newNewsId), "News article anchor should be created");
    });

    /// <summary>
    /// Verifies that comments work correctly for Problem target (exists) and News target (slug).
    /// </summary>
    [Fact]
    public Task CreateCommentAsync_WorksForProblemAndNewsTargets() => RunTestAsync(async commentService =>
    {
        // Arrange
        var problemTarget = new CommentTarget(CommentTargetType.Problem, _testProblemSlug);
        var newsTarget = new CommentTarget(CommentTargetType.News, _testNewsId);

        // Act
        await commentService.CreateCommentAsync(problemTarget, _user1Id, "Problem comment");
        await commentService.CreateCommentAsync(newsTarget, _user1Id, "News comment");

        // Verify problem
        var problemResponse = await commentService.GetCommentsAsync(problemTarget, _user1Id);
        Assert.Single(problemResponse);
        Assert.Equal("Problem comment", problemResponse[0].Content);

        // Verify news
        var newsResponse = await commentService.GetCommentsAsync(newsTarget, _user1Id);
        Assert.Single(newsResponse);
        Assert.Equal("News comment", newsResponse[0].Content);
    });

    /// <summary>
    /// Verifies that GetCommentCountsAsync returns correct counts for multiple news articles.
    /// </summary>
    [Fact]
    public Task GetCommentCountsAsync_ReturnsCorrectCountsForNews() => RunTestAsync(async commentService =>
    {
        // Arrange
        var id1 = "news-1";
        var id2 = "news-2";
        var id3 = "news-3";

        // Create comments
        await commentService.CreateCommentAsync(new CommentTarget(CommentTargetType.News, id1), _user1Id, "c1");
        await commentService.CreateCommentAsync(new CommentTarget(CommentTargetType.News, id1), _user2Id, "c2");
        await commentService.CreateCommentAsync(new CommentTarget(CommentTargetType.News, id2), _user1Id, "c3");

        // Act
        var counts = await commentService.GetCommentCountsAsync(
            CommentTargetType.News,
            ImmutableList.Create(id1, id2, id3)
        );

        // Assert - only slugs with comments are returned
        Assert.Equal(2, counts.Count);
        Assert.Equal(2, counts[id1]);
        Assert.Equal(1, counts[id2]);
        Assert.False(counts.ContainsKey(id3));
    });

    /// <summary>
    /// Verifies that GetCommentsAsync does not return Superseded comments (old edit versions).
    /// </summary>
    [Fact]
    public Task GetCommentsAsync_ExcludesSupersededComments() => RunTestAsync(async commentService =>
    {
        // Arrange
        var target = new CommentTarget(CommentTargetType.Handout, _testHandoutId);

        // Create original comment
        var original = await commentService.CreateCommentAsync(target, _user1Id, "Original content");

        // Update the comment (this supersedes the original)
        await commentService.UpdateCommentAsync(target, original.Id, _user1Id, "Updated content");

        // Act
        var response = await commentService.GetCommentsAsync(target, _user1Id);

        // Assert - should only have 1 comment (the new version), not the superseded one
        Assert.Single(response);
        Assert.Equal("Updated content", response[0].Content);
        Assert.NotEqual(original.Id, response[0].Id);
    });

    /// <summary>
    /// Verifies that GetCommentsAsync returns Deleted comments, but with empty content.
    /// </summary>
    [Fact]
    public Task GetCommentsAsync_ReturnsDeletedCommentsWithEmptyContent() => RunTestAsync(async commentService =>
    {
        // Arrange
        var target = new CommentTarget(CommentTargetType.Handout, _testHandoutId);

        // Create a comment
        var comment = await commentService.CreateCommentAsync(target, _user1Id, "Original content");

        // Soft-delete it
        await commentService.DeleteCommentAsync(comment.Id, _user1Id);

        // Act
        var response = await commentService.GetCommentsAsync(target, _user1Id);

        // Assert - comment should be returned but with empty content
        Assert.Single(response);
        Assert.True(response[0].IsDeleted);
        Assert.Equal(string.Empty, response[0].Content);
    });

    /// <summary>
    /// Verifies that GetCommentCountsAsync only counts Active comments.
    /// Deleted and Superseded comments should not be counted.
    /// </summary>
    [Fact]
    public Task GetCommentCountsAsync_OnlyCountsActiveComments() => RunTestAsync(async commentService =>
    {
        // Arrange
        var id = "test-count-active";
        var target = new CommentTarget(CommentTargetType.News, id);

        // Create 3 comments
        _ = await commentService.CreateCommentAsync(target, _user1Id, "Active 1");
        var comment2 = await commentService.CreateCommentAsync(target, _user1Id, "Active 2");
        var comment3 = await commentService.CreateCommentAsync(target, _user2Id, "Will be deleted");

        // Delete comment3
        await commentService.DeleteCommentAsync(comment3.Id, _user2Id);

        // Update comment2 (this creates a new version and supersedes the old one)
        await commentService.UpdateCommentAsync(target, comment2.Id, _user1Id, "Updated 2");

        // Now we have: 1 active (comment1), 1 new active from update, 1 superseded (old comment2), 1 deleted (comment3)
        // Total active: 2

        // Act
        var counts = await commentService.GetCommentCountsAsync(
            CommentTargetType.News,
            [id]
        );

        // Assert - should only count 2 active comments
        Assert.Equal(2, counts[id]);
    });

    /// <inheritdoc />
    protected override async Task SeedDataAsync(MathCompsDbContext context)
    {
        // Create News Article
        context.NewsArticles.Add(new NewsArticle
        {
            Id = Guid.NewGuid(),
            ContentId = _testNewsId
        });
        // Create test users
        context.Users.Add(new User
        {
            Id = _user1Id,
            ExternalId = _user1ExternalId,
            DisplayName = "User 1",
            Email = "user1@example.com",
            AvatarUrl = _user1AvatarUrl,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        });
        context.Users.Add(new User
        {
            Id = _user2Id,
            ExternalId = _user2ExternalId,
            DisplayName = "User 2",
            Email = "user2@example.com",
            AvatarUrl = null,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        });

        // Create Season
        var season = new Season
        {
            Id = Guid.NewGuid(),
            StartYear = 2024,
            EditionNumber = 1
        };
        context.Seasons.Add(season);

        // Create Round
        var round = new Round
        {
            Id = Guid.NewGuid(),
            CompetitionId = CompetitionTreeSeed.Chain(context, "testcomp-testround").Id,
            SeasonId = season.Id,
            Date = DateOnly.FromDateTime(DateTime.Today)
        };
        context.Rounds.Add(round);

        // Create Problem
        var problem = new Problem
        {
            RoundId = round.Id,
            Number = 1,
            Slug = _testProblemSlug
        };
        context.Problems.Add(problem);

        // Submit changes
        await context.SaveChangesAsync();
    }
}

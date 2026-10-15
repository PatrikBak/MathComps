using MathComps.Domain.Contracts.Comments;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Extensions;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Comments;
using MathComps.Infrastructure.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using static MathComps.Infrastructure.Tests.TestInfrastructure.HostedSeed;

namespace MathComps.Infrastructure.Tests.Comments;

/// <summary>
/// Integration tests for the public comment threads as <see cref="ICommentService"/> keeps them against a real
/// PostgreSQL database: who a comment is signed by, reactions, deletion, edits that write a new version and keep its
/// replies, nesting, bulk counts, and a hosted problem, which has no thread.
/// </summary>
/// <param name="fixture">The shared PostgreSQL container fixture.</param>
public class CommentServicePostgresTests(PostgresContainerFixture fixture)
    : PostgresTestBase<ICommentService>(fixture)
{
    /// <summary>
    /// The id of the user who writes most of the comments.
    /// </summary>
    private static readonly Guid _user1Id = Guid.Parse("00000000-0000-0000-0000-000000000001");

    /// <summary>
    /// The id of a second user, who reacts, replies and tries the author-only actions.
    /// </summary>
    private static readonly Guid _user2Id = Guid.Parse("00000000-0000-0000-0000-000000000002");

    /// <summary>
    /// The first user, signed in and no admin.
    /// </summary>
    private static readonly CommentViewer _user1 = new(_user1Id, IsAdmin: false);

    /// <summary>
    /// The second user, signed in and no admin.
    /// </summary>
    private static readonly CommentViewer _user2 = new(_user2Id, IsAdmin: false);

    /// <summary>
    /// The first user's <see cref="User.ExternalId"/>.
    /// </summary>
    private const string User1ExternalId = "user1";

    /// <summary>
    /// The second user's <see cref="User.ExternalId"/>.
    /// </summary>
    private const string User2ExternalId = "user2";

    /// <summary>
    /// The first user's <see cref="User.AvatarUrl"/>.
    /// </summary>
    private const string User1AvatarUrl = "https://example.com/avatars/user1.png";

    /// <summary>
    /// A handout nothing seeds, so its first comment creates its row.
    /// </summary>
    private const string HandoutId = "test-handout";

    /// <summary>
    /// The seeded news article's content id.
    /// </summary>
    private const string NewsId = "test-news";

    /// <summary>
    /// The seeded problem's slug, which names its thread.
    /// </summary>
    private const string ProblemSlug = "p1";

    /// <summary>
    /// The thread of the handout nothing seeds.
    /// </summary>
    private static readonly CommentTarget _handoutThread = new(CommentTargetType.Handout, HandoutId);

    /// <summary>
    /// The seeded problem's thread.
    /// </summary>
    private static readonly CommentTarget _problemThread = new(CommentTargetType.Problem, ProblemSlug);

    /// <summary>
    /// The slug of the problem in a hosted round still running.
    /// </summary>
    private const string HostedProblemSlug = "mathcomps-advanced-october-1";

    /// <summary>
    /// The thread the hosted problem's slug names.
    /// </summary>
    private static readonly CommentTarget _hostedThread = new(CommentTargetType.Problem, HostedProblemSlug);

    /// <summary>
    /// The problem in a hosted round still running.
    /// </summary>
    private readonly Guid _hostedProblemId = Guid.CreateVersion7();

    /// <summary>
    /// Content exactly as long as a comment may carry.
    /// </summary>
    private static readonly string _longestContent = new('a', ICommentService.MaxCommentChars);

    /// <inheritdoc/>
    protected override void ConfigureServices(IServiceCollection services) =>
        // Register the user services module the test resolves from
        services.AddUserServices();

    /// <summary>
    /// A handout or news article nobody has commented on reads as an empty thread, and reading it mints no row for
    /// it, which only its first comment does. Reading runs for every visitor of every page, so a read that minted
    /// would write a row for any content id anybody sends.
    /// </summary>
    [Fact]
    public Task GetCommentsAsync_ReturnsEmptyListWhenNoComments() => RunTestAsync(async commentService =>
    {
        // A news article nothing seeds
        var newsThread = new CommentTarget(CommentTargetType.News, "unseeded-news");

        // The untouched handout's thread, as the first user reads it
        var handoutComments = await commentService.GetCommentsAsync(_handoutThread, _user1);

        // The untouched article's thread
        var newsComments = await commentService.GetCommentsAsync(newsThread, _user1);

        // Nothing in either
        Assert.Empty(handoutComments);
        Assert.Empty(newsComments);

        // No row minted for the handout
        Assert.False(await QueryValueAsync(context =>
            context.Handouts.AnyAsync(handout => handout.ContentId == HandoutId)));

        // Nor for the article
        Assert.False(await QueryValueAsync(context =>
            context.NewsArticles.AnyAsync(news => news.ContentId == newsThread.TargetId)));
    });

    /// <summary>
    /// A signed-out reader reads a thread like anyone else, the reactions on it and who gave them included.
    /// </summary>
    [Fact]
    public Task GetCommentsAsync_AllowsASignedOutReader() => RunTestAsync(async commentService =>
    {
        // The first user comments on the handout
        var created = await commentService.CreateCommentAsync(_handoutThread, _user1, "Public comment");

        // The second user gives it a thumbs-down
        await commentService.PressReactionAsync(created.Id, _user2, CommentReactionKind.ThumbsDown);

        // The thread as a signed-out reader gets it
        var thread = await commentService.GetCommentsAsync(_handoutThread, null);

        // The comment, readable
        var comment = Assert.Single(thread);
        Assert.Equal("Public comment", comment.Content);

        // With the second user's thumbs-down on it, under their username
        Assert.Equal(
            new CommentReactionDto(User2ExternalId, "User 2", CommentReactionKind.ThumbsDown),
            Assert.Single(comment.Reactions));
    });

    /// <summary>
    /// A comment is signed with the author's username. Each projection that names an author is written on its
    /// own, LINQ for the comment just created and raw SQL for the thread read back, so each is asserted here: a
    /// fix that misses one renames a student's comment the moment the page reloads.
    /// </summary>
    [Fact]
    public Task CreateCommentAsync_SignsTheCommentWithTheUsername() => RunTestAsync(async commentService =>
    {
        // The author has taken a name of their own
        await NameTheAuthorAsync("Peťo Novák");

        // The author writes something
        var created = await commentService.CreateCommentAsync(_handoutThread, _user1, "Signed.");

        // The new comment comes back signed with that name
        Assert.Equal("Peťo Novák", created.Author.Name);

        // The thread the comment lands in
        var thread = await commentService.GetCommentsAsync(_handoutThread, _user1);

        // Signed with the same name
        Assert.Equal("Peťo Novák", thread[0].Author.Name);
    });

    /// <summary>
    /// A deleted account stops being named. Deletion leaves the username standing, so the thread's projection
    /// withholding it is all that keeps somebody who asked to be gone from still signing every comment they wrote.
    /// </summary>
    [Fact]
    public Task GetCommentsAsync_DoesNotNameADeletedAuthorByTheirUsername() => RunTestAsync(async commentService =>
    {
        // An author with a name of their own
        await NameTheAuthorAsync("Peťo Novák");

        // The author writes something
        await commentService.CreateCommentAsync(_handoutThread, _user1, "Written before leaving.");

        // The author deletes their account, the username left standing
        await QueryAsync(async context =>
        {
            // The author's row
            var user = await context.Users.SingleAsync(user => user.Id == _user1Id);

            // Marked deleted
            user.IsDeleted = true;

            // Save the deletion
            await context.SaveChangesAsync();
        });

        // The thread as a signed-out reader gets it
        var thread = await commentService.GetCommentsAsync(_handoutThread, null);

        // The comment stands, signed by nobody in particular
        Assert.Null(thread[0].Author.Name);
    });

    /// <summary>
    /// A deleted account stops being named on its reactions too. The reactions are read by a projection of their
    /// own, apart from the one naming the thread's authors, so withholding the name is asserted for them separately.
    /// </summary>
    [Fact]
    public Task GetCommentsAsync_DoesNotNameADeletedAccountOnItsReactions() => RunTestAsync(async commentService =>
    {
        // The first user's comment on the handout
        var comment = await commentService.CreateCommentAsync(_handoutThread, _user1, "Reacted to before leaving.");

        // The second user gives it a thumbs-up
        await commentService.PressReactionAsync(comment.Id, _user2, CommentReactionKind.ThumbsUp);

        // The second user deletes their account, the username left standing
        await QueryAsync(context => context.Users
            .Where(user => user.Id == _user2Id)
            .ExecuteUpdateAsync(setters => setters.SetProperty(user => user.IsDeleted, true)));

        // The thread as a signed-out reader gets it
        var thread = await commentService.GetCommentsAsync(_handoutThread, null);

        // The thumbs-up stands, given by nobody in particular
        Assert.Null(Assert.Single(thread[0].Reactions).Name);
    });

    /// <summary>
    /// An author with no username is refused, a reply as much as a top-level comment, since a comment nobody can
    /// be named for reads like one from a deleted account. The refusal comes before anything is written, so not
    /// even the row standing for an uncommented handout is minted.
    /// </summary>
    [Fact]
    public Task CreateCommentAsync_RefusesAnAuthorWithNoUsername() => RunTestAsync(async commentService =>
    {
        // The first user has never taken a name
        await QueryAsync(context => context.Users
            .Where(user => user.Id == _user1Id)
            .ExecuteUpdateAsync(setters => setters.SetProperty(user => user.Username, (string?)null)));

        // The first user writes on the handout nobody has commented on
        await Assert.ThrowsAsync<CommentProfileIncompleteException>(
            () => commentService.CreateCommentAsync(_handoutThread, _user1, "Nameless."));

        // The handout still has no row standing for it
        Assert.False(await QueryValueAsync(context =>
            context.Handouts.AnyAsync(handout => handout.ContentId == HandoutId)));

        // The second user, who has a name, comments on the problem
        var named = await commentService.CreateCommentAsync(_problemThread, _user2, "Signed.");

        // The first user replies to the second user's comment
        await Assert.ThrowsAsync<CommentProfileIncompleteException>(
            () => commentService.CreateCommentAsync(_problemThread, _user1, "Nameless reply.", named.Id));

        // The problem's thread as the next reader gets it
        var thread = await commentService.GetCommentsAsync(_problemThread, null);

        // Holding the second user's comment alone, with nothing under it
        var root = Assert.Single(thread);
        Assert.Equal(named.Id, root.Id);
        Assert.Empty(root.Replies);
    });

    /// <summary>
    /// A new top-level comment comes back as written, signed with its author's id, username and avatar, with
    /// nothing on it yet, and the thread then holds it.
    /// </summary>
    [Fact]
    public Task CreateCommentAsync_CreatesTopLevelComment() => RunTestAsync(async commentService =>
    {
        // The comment's text
        var content = "This is a test comment.";

        // The first user comments on the handout
        var created = await commentService.CreateCommentAsync(_handoutThread, _user1, content);

        // The text as written
        Assert.Equal(content, created.Content);

        // Signed with the author's id, username and avatar
        Assert.Equal(User1ExternalId, created.Author.Id);
        Assert.Equal("User 1", created.Author.Name);
        Assert.Equal(User1AvatarUrl, created.Author.AvatarUrl);

        // Nothing on it yet: no replies, no deletion, no reactions
        Assert.Empty(created.Replies);
        Assert.False(created.IsDeleted);
        Assert.Empty(created.Reactions);

        // The handout's thread as the author reads it
        var thread = await commentService.GetCommentsAsync(_handoutThread, _user1);

        // Holding just the new comment
        Assert.Equal(content, Assert.Single(thread).Content);
    });

    /// <summary>
    /// A comment has to say something, and no more than <see cref="ICommentService.MaxCommentChars"/> characters of
    /// it, counted once the whitespace around it is gone. A refusal writes nothing, so not even the row standing for an
    /// uncommented handout is minted, and the comment that passes is stored trimmed.
    /// </summary>
    [Fact]
    public Task CreateCommentAsync_HoldsTheContentToItsBounds() => RunTestAsync(async commentService =>
    {
        // Whitespace is the same as saying nothing
        await Assert.ThrowsAsync<CommentValueException>(
            () => commentService.CreateCommentAsync(_handoutThread, _user1, " \n\t "));

        // One character past the ceiling
        await Assert.ThrowsAsync<CommentValueException>(
            () => commentService.CreateCommentAsync(_handoutThread, _user1, $"{_longestContent}a"));

        // The handout still has no row standing for it
        Assert.False(await QueryValueAsync(context =>
            context.Handouts.AnyAsync(handout => handout.ContentId == HandoutId)));

        // Right at the ceiling, wrapped in whitespace that doesn't count
        var created = await commentService.CreateCommentAsync(_handoutThread, _user1, $"  {_longestContent}\n");

        // The comment comes back without the whitespace
        Assert.Equal(_longestContent, created.Content);

        // The comment is stored without the whitespace too
        Assert.Equal(_longestContent, await QueryValueAsync(context => context.Comments
            .Where(comment => comment.Id == created.Id)
            .Select(comment => comment.Content)
            .SingleAsync()));
    });

    /// <summary>
    /// A first press gives the reader's thumbs-up, signed with who they are, and pressing the same one again takes
    /// it back.
    /// </summary>
    [Fact]
    public Task PressReactionAsync_AddsAndTakesBackAReaction() => RunTestAsync(async commentService =>
    {
        // The first user's comment on the handout
        var comment = await commentService.CreateCommentAsync(_handoutThread, _user1, "Test comment");

        // The second user gives the comment a thumbs-up
        await commentService.PressReactionAsync(comment.Id, _user2, CommentReactionKind.ThumbsUp);

        // The thread as the second user reads it
        var pressed = await commentService.GetCommentsAsync(_handoutThread, _user2);

        // One thumbs-up, the second user's
        Assert.Equal(
            new CommentReactionDto(User2ExternalId, "User 2", CommentReactionKind.ThumbsUp),
            Assert.Single(pressed[0].Reactions));

        // The second user presses the thumbs-up again
        await commentService.PressReactionAsync(comment.Id, _user2, CommentReactionKind.ThumbsUp);

        // The thread as the second user reads it now
        var takenBack = await commentService.GetCommentsAsync(_handoutThread, _user2);

        // No reactions left
        Assert.Empty(takenBack[0].Reactions);
    });

    /// <summary>
    /// A reader holds one reaction at most, so pressing the other one swaps to it.
    /// </summary>
    [Fact]
    public Task PressReactionAsync_SwapsToTheOtherKind() => RunTestAsync(async commentService =>
    {
        // The first user's comment on the handout
        var comment = await commentService.CreateCommentAsync(_handoutThread, _user1, "Test comment");

        // The second user gives the comment a thumbs-up
        await commentService.PressReactionAsync(comment.Id, _user2, CommentReactionKind.ThumbsUp);

        // The second user changes their mind and presses the thumbs-down
        await commentService.PressReactionAsync(comment.Id, _user2, CommentReactionKind.ThumbsDown);

        // The thread as the second user reads it
        var thread = await commentService.GetCommentsAsync(_handoutThread, _user2);

        // The one reaction, now a thumbs-down
        Assert.Equal(CommentReactionKind.ThumbsDown, Assert.Single(thread[0].Reactions).Kind);
    });

    /// <summary>
    /// A press touches only the presser's own reaction, so a reader taking theirs back leaves another reader's
    /// reaction of the same kind standing.
    /// </summary>
    [Fact]
    public Task PressReactionAsync_LeavesOtherReadersReactionsAlone() => RunTestAsync(async commentService =>
    {
        // A third user, who reacts beside the second
        var user3 = new CommentViewer(Guid.CreateVersion7(), IsAdmin: false);

        // The third user's account
        await QueryAsync(async context =>
        {
            // The third user's row
            context.Users.Add(NewUser(user3.UserId, "User3"));

            // Save the account
            await context.SaveChangesAsync();
        });

        // The first user's comment on the handout
        var comment = await commentService.CreateCommentAsync(_handoutThread, _user1, "Test comment");

        // The second user gives the comment a thumbs-up
        await commentService.PressReactionAsync(comment.Id, _user2, CommentReactionKind.ThumbsUp);

        // The third user gives it a thumbs-up too
        await commentService.PressReactionAsync(comment.Id, user3, CommentReactionKind.ThumbsUp);

        // The third user takes their thumbs-up back
        await commentService.PressReactionAsync(comment.Id, user3, CommentReactionKind.ThumbsUp);

        // The thread as the second user reads it
        var thread = await commentService.GetCommentsAsync(_handoutThread, _user2);

        // The second user's thumbs-up, still standing on its own
        Assert.Equal(User2ExternalId, Assert.Single(thread[0].Reactions).UserId);
    });

    /// <summary>
    /// A press touches only the comment it is made on, so a reader giving two comments the same reaction holds it on
    /// both, each listed under its own comment.
    /// </summary>
    [Fact]
    public Task PressReactionAsync_LeavesTheReadersOtherCommentsAlone() => RunTestAsync(async commentService =>
    {
        // The first user's comment on the handout
        var first = await commentService.CreateCommentAsync(_handoutThread, _user1, "First comment");

        // The first user's second comment on the handout
        var second = await commentService.CreateCommentAsync(_handoutThread, _user1, "Second comment");

        // The second user gives the first comment a thumbs-up
        await commentService.PressReactionAsync(first.Id, _user2, CommentReactionKind.ThumbsUp);

        // The second user gives the second comment a thumbs-up too
        await commentService.PressReactionAsync(second.Id, _user2, CommentReactionKind.ThumbsUp);

        // The thread as the second user reads it
        var thread = await commentService.GetCommentsAsync(_handoutThread, _user2);

        // A check that a comment holds the second user's thumbs-up and nothing else
        static void HoldsTheThumbsUp(CommentDto comment) => Assert.Equal(
            new CommentReactionDto(User2ExternalId, "User 2", CommentReactionKind.ThumbsUp),
            Assert.Single(comment.Reactions));

        // Each comment holding the second user's thumbs-up alone
        Assert.Collection(thread, HoldsTheThumbsUp, HoldsTheThumbsUp);
    });

    /// <summary>
    /// An author's reaction on their own comment is refused.
    /// </summary>
    [Fact]
    public Task PressReactionAsync_ThrowsWhenReactingToOwnComment() => RunTestAsync(async commentService =>
    {
        // The first user's comment
        var comment = await commentService.CreateCommentAsync(_handoutThread, _user1, "Test comment");

        // The author gives their own comment a thumbs-up
        await Assert.ThrowsAsync<CannotReactToOwnCommentException>(
            () => commentService.PressReactionAsync(comment.Id, _user1, CommentReactionKind.ThumbsUp));
    });

    /// <summary>
    /// A reaction on a comment that does not exist is refused as not found.
    /// </summary>
    [Fact]
    public Task PressReactionAsync_ThrowsWhenCommentMissing() => RunTestAsync(async commentService =>
    {
        // The first user reacts to a comment nobody wrote
        await Assert.ThrowsAsync<CommentNotFoundException>(
            () => commentService.PressReactionAsync(Guid.NewGuid(), _user1, CommentReactionKind.ThumbsUp));
    });

    /// <summary>
    /// A delete by anyone but the author is refused.
    /// </summary>
    [Fact]
    public Task DeleteCommentAsync_ThrowsWhenNotAuthor() => RunTestAsync(async commentService =>
    {
        // The first user's comment
        var comment = await commentService.CreateCommentAsync(_handoutThread, _user1, "Test comment");

        // The second user deletes the first one's comment
        await Assert.ThrowsAsync<NotCommentAuthorException>(
            () => commentService.DeleteCommentAsync(comment.Id, _user2));
    });

    /// <summary>
    /// A thread reads back as the tree its replies were written into, each reply under its own parent at any depth:
    /// - Root 1 (User 1)
    ///   - Reply 1.1 (User 2)
    ///     - Reply 1.1.1 (User 1)
    ///   - Reply 1.2 (User 1)
    /// - Root 2 (User 2)
    ///   - Reply 2.1 (User 1)
    /// </summary>
    [Fact]
    public Task GetCommentsAsync_NestsEachReplyUnderItsParent() => RunTestAsync(async commentService =>
    {
        // Root 1
        var root1 = await commentService.CreateCommentAsync(_handoutThread, _user1, "Root 1");

        // Reply 1.1 -> Root 1
        var reply1_1 = await commentService.CreateCommentAsync(_handoutThread, _user2, "Reply 1.1", root1.Id);

        // Reply 1.1.1 -> Reply 1.1
        await commentService.CreateCommentAsync(_handoutThread, _user1, "Reply 1.1.1", reply1_1.Id);

        // Reply 1.2 -> Root 1
        var reply1_2 = await commentService.CreateCommentAsync(_handoutThread, _user1, "Reply 1.2", root1.Id);

        // Root 2
        var root2 = await commentService.CreateCommentAsync(_handoutThread, _user2, "Root 2");

        // Reply 2.1 -> Root 2
        await commentService.CreateCommentAsync(_handoutThread, _user1, "Reply 2.1", root2.Id);

        // The whole thread, as the first user reads it
        var response = await commentService.GetCommentsAsync(_handoutThread, _user1);

        // Both roots at the top
        Assert.Equal(2, response.Count);

        // Root 1, holding both its replies
        var root1Dto = response.Single(comment => comment.Id == root1.Id);
        Assert.Equal("Root 1", root1Dto.Content);
        Assert.Equal(2, root1Dto.Replies.Count);

        // Reply 1.1, by the second user, holding its one reply
        var reply1_1Dto = root1Dto.Replies.Single(comment => comment.Id == reply1_1.Id);
        Assert.Equal("Reply 1.1", reply1_1Dto.Content);
        Assert.Equal(User2ExternalId, reply1_1Dto.Author.Id);
        Assert.Single(reply1_1Dto.Replies);

        // Reply 1.1.1, by the first user, a leaf
        var reply1_1_1Dto = reply1_1Dto.Replies[0];
        Assert.Equal("Reply 1.1.1", reply1_1_1Dto.Content);
        Assert.Equal(User1ExternalId, reply1_1_1Dto.Author.Id);
        Assert.Empty(reply1_1_1Dto.Replies);

        // Reply 1.2, by the first user, a leaf
        var reply1_2Dto = root1Dto.Replies.Single(comment => comment.Id == reply1_2.Id);
        Assert.Equal("Reply 1.2", reply1_2Dto.Content);
        Assert.Equal(User1ExternalId, reply1_2Dto.Author.Id);
        Assert.Empty(reply1_2Dto.Replies);

        // Root 2, holding its one reply
        var root2Dto = response.Single(comment => comment.Id == root2.Id);
        Assert.Equal("Root 2", root2Dto.Content);
        Assert.Single(root2Dto.Replies);

        // Reply 2.1, a leaf
        var reply2_1Dto = root2Dto.Replies[0];
        Assert.Equal("Reply 2.1", reply2_1Dto.Content);
        Assert.Empty(reply2_1Dto.Replies);
    });

    /// <summary>
    /// An edit writes a new version under its own id, stamped with the edit time, and the thread shows that
    /// version with the new text.
    /// </summary>
    [Fact]
    public Task UpdateCommentAsync_UpdatesContent() => RunTestAsync(async commentService =>
    {
        // The first user's comment
        var comment = await commentService.CreateCommentAsync(_handoutThread, _user1, "Original content");

        // The author edits the comment
        var result = await commentService.UpdateCommentAsync(comment.Id, _user1, "Updated content");

        // A new version, under its own id
        Assert.NotEqual(comment.Id, result.Id);

        // The thread as the author reads it
        var thread = await commentService.GetCommentsAsync(_handoutThread, _user1);

        // Only the new version, with the new text
        var root = Assert.Single(thread);
        Assert.Equal(result.Id, root.Id);
        Assert.Equal("Updated content", root.Content);

        // Stamped with the edit's time, to the microsecond the column keeps
        Assert.Equal(
            result.EditedAt.TruncateToMicroseconds(),
            root.EditedAt!.Value.TruncateToMicroseconds());
    });

    /// <summary>
    /// An edit by anyone but the author is refused.
    /// </summary>
    [Fact]
    public Task UpdateCommentAsync_ThrowsWhenNotAuthor() => RunTestAsync(async commentService =>
    {
        // The first user's comment
        var comment = await commentService.CreateCommentAsync(_handoutThread, _user1, "Original content");

        // The second user edits the first one's comment
        await Assert.ThrowsAsync<NotCommentAuthorException>(
            () => commentService.UpdateCommentAsync(comment.Id, _user2, "Hacked content"));
    });

    /// <summary>
    /// An edited comment keeps its replies. An edit writes a new version and supersedes the old one, while the
    /// replies were written against the old id, so a thread that follows only live versions loses every reply
    /// the moment its parent is edited.
    /// </summary>
    [Fact]
    public Task UpdateCommentAsync_KeepsReplies() => RunTestAsync(async commentService =>
    {
        // The first user's comment on the problem
        var comment = await commentService.CreateCommentAsync(_problemThread, _user1, "Original content");

        // The second user's reply to it
        var reply = await commentService.CreateCommentAsync(_problemThread, _user2, "A reply", comment.Id);

        // The author fixes a typo
        var edited = await commentService.UpdateCommentAsync(comment.Id, _user1, "Fixed content");

        // The thread as the next reader gets it
        var thread = await commentService.GetCommentsAsync(_problemThread, null);

        // The edited version stands in the thread, with the reply still under it
        var root = Assert.Single(thread);
        Assert.Equal(edited.Id, root.Id);
        Assert.Equal(reply.Id, Assert.Single(root.Replies).Id);
    });

    /// <summary>
    /// An edited comment keeps its reactions, each of its own kind. The reactions were given to the old version, and
    /// a thread lists only the ones on the versions it shows, so an edit leaving them behind wipes every reaction the
    /// moment the author fixes a typo. The reaction is a thumbs-down, since a copy that dropped the kind would turn a
    /// thumbs-down into a thumbs-up.
    /// </summary>
    [Fact]
    public Task UpdateCommentAsync_KeepsReactions() => RunTestAsync(async commentService =>
    {
        // The first user's comment on the problem
        var comment = await commentService.CreateCommentAsync(_problemThread, _user1, "Original content");

        // The second user gives the comment a thumbs-down
        await commentService.PressReactionAsync(comment.Id, _user2, CommentReactionKind.ThumbsDown);

        // The author fixes a typo
        var edited = await commentService.UpdateCommentAsync(comment.Id, _user1, "Fixed content");

        // The thread as the second user reads it
        var thread = await commentService.GetCommentsAsync(_problemThread, _user2);

        // The edited version stands in the thread
        var root = Assert.Single(thread);
        Assert.Equal(edited.Id, root.Id);

        // The edited version still carries the second user's thumbs-down
        Assert.Equal(
            new CommentReactionDto(User2ExternalId, "User 2", CommentReactionKind.ThumbsDown),
            Assert.Single(root.Reactions));
    });

    /// <summary>
    /// A version an edit replaced is gone for good. A reader whose page still shows it acts on its id, and the
    /// thread never reaches a superseded version: a reply under it would vanish, a second edit would show the
    /// comment twice, and a delete would leave the live version standing.
    /// </summary>
    [Fact]
    public Task UpdateCommentAsync_RetiresTheOldVersion() => RunTestAsync(async commentService =>
    {
        // The first user's comment on the problem
        var comment = await commentService.CreateCommentAsync(_problemThread, _user1, "Original content");

        // The author edits it
        var edited = await commentService.UpdateCommentAsync(comment.Id, _user1, "Fixed content");

        // Someone replies to the old version from a page loaded before the edit
        await Assert.ThrowsAsync<CommentNotFoundException>(
            () => commentService.CreateCommentAsync(_problemThread, _user2, "A reply", comment.Id));

        // The author edits the old version again from that stale page
        await Assert.ThrowsAsync<CommentNotFoundException>(
            () => commentService.UpdateCommentAsync(comment.Id, _user1, "Fixed again"));

        // The author deletes the old version from that stale page
        await Assert.ThrowsAsync<CommentNotFoundException>(
            () => commentService.DeleteCommentAsync(comment.Id, _user1));

        // The thread as the next reader gets it
        var thread = await commentService.GetCommentsAsync(_problemThread, null);

        // Only the edited version, untouched and alone
        var root = Assert.Single(thread);
        Assert.Equal(edited.Id, root.Id);
        Assert.False(root.IsDeleted);
    });

    /// <summary>
    /// An edited comment keeps its posting time and its place in the thread. Each edit writes a new version with
    /// its own time, and the posting time is the first version's however many edits stand between.
    /// </summary>
    [Fact]
    public Task UpdateCommentAsync_KeepsThePostingTimeAndPlace() => RunTestAsync(async commentService =>
    {
        // The first user's comment on the problem
        var first = await commentService.CreateCommentAsync(_problemThread, _user1, "First");

        // The second user's comment after it
        var second = await commentService.CreateCommentAsync(_problemThread, _user2, "Second");

        // The author edits the first comment
        var edited = await commentService.UpdateCommentAsync(first.Id, _user1, "First, fixed");

        // The author edits the comment again, leaving its first version two edits back
        var editedAgain = await commentService.UpdateCommentAsync(edited.Id, _user1, "First, fixed again");

        // The thread as the next reader gets it
        var thread = await commentService.GetCommentsAsync(_problemThread, null);

        // The edited comment still first, ahead of the one posted after it
        Assert.Equal(2, thread.Count);
        Assert.Equal(editedAgain.Id, thread[0].Id);
        Assert.Equal(second.Id, thread[1].Id);

        // The edited comment stamped with when it was first posted, to the microsecond the column keeps
        Assert.Equal(first.CreatedAt.TruncateToMicroseconds(), thread[0].CreatedAt.TruncateToMicroseconds());
    });

    /// <summary>
    /// A deleted comment stays deleted. An edit writes a new live version, so editing a deleted comment would
    /// bring it back.
    /// </summary>
    [Fact]
    public Task UpdateCommentAsync_RefusesADeletedComment() => RunTestAsync(async commentService =>
    {
        // The first user's comment
        var comment = await commentService.CreateCommentAsync(_handoutThread, _user1, "Original content");

        // The author deletes the comment
        await commentService.DeleteCommentAsync(comment.Id, _user1);

        // The author edits the deleted comment
        await Assert.ThrowsAsync<CommentNotFoundException>(
            () => commentService.UpdateCommentAsync(comment.Id, _user1, "Back again"));

        // The thread as the author reads it
        var thread = await commentService.GetCommentsAsync(_handoutThread, _user1);

        // The comment still deleted
        Assert.True(Assert.Single(thread).IsDeleted);
    });

    /// <summary>
    /// An edit is held to the same bounds as a new comment: it has to say something, and no more than
    /// <see cref="ICommentService.MaxCommentChars"/> characters once the whitespace around it is gone. A refused edit
    /// leaves the comment as it was, under its own id.
    /// </summary>
    [Fact]
    public Task UpdateCommentAsync_HoldsTheContentToItsBounds() => RunTestAsync(async commentService =>
    {
        // The first user's comment
        var comment = await commentService.CreateCommentAsync(_handoutThread, _user1, "Original content");

        // The author edits the comment down to whitespace
        await Assert.ThrowsAsync<CommentValueException>(
            () => commentService.UpdateCommentAsync(comment.Id, _user1, " \n\t "));

        // The author edits the comment one character past the ceiling
        await Assert.ThrowsAsync<CommentValueException>(
            () => commentService.UpdateCommentAsync(comment.Id, _user1, $"{_longestContent}a"));

        // The thread as the author reads it
        var thread = await commentService.GetCommentsAsync(_handoutThread, _user1);

        // The comment as it was, under its own id
        var untouched = Assert.Single(thread);
        Assert.Equal(comment.Id, untouched.Id);
        Assert.Equal("Original content", untouched.Content);

        // The author edits the comment right up to the ceiling, wrapped in whitespace that doesn't count
        await commentService.UpdateCommentAsync(comment.Id, _user1, $"  {_longestContent}\n");

        // The thread as the author reads it after the edit
        var editedThread = await commentService.GetCommentsAsync(_handoutThread, _user1);

        // The new version, stored without the whitespace
        Assert.Equal(_longestContent, Assert.Single(editedThread).Content);
    });

    /// <summary>
    /// The first comment on a handout or news article nobody has seeded creates its <see cref="Handout"/> or
    /// <see cref="NewsArticle"/> row.
    /// </summary>
    [Fact]
    public Task CreateCommentAsync_AutoCreatesHandoutAndNewsArticleAnchors() => RunTestAsync(async commentService =>
    {
        // A handout with no row yet
        var newHandoutId = "brand-new-handout";

        // A news article with no row yet
        var newNewsId = "brand-new-news";

        // The first user comments on the new handout
        await commentService.CreateCommentAsync(
            new CommentTarget(CommentTargetType.Handout, newHandoutId), _user1, "handout comm");

        // The first user comments on the new news article
        await commentService.CreateCommentAsync(
            new CommentTarget(CommentTargetType.News, newNewsId), _user1, "news comm");

        // A row now stands for the new handout
        Assert.True(await QueryValueAsync(context =>
            context.Handouts.AnyAsync(handout => handout.ContentId == newHandoutId)));

        // And one for the new news article
        Assert.True(await QueryValueAsync(context =>
            context.NewsArticles.AnyAsync(news => news.ContentId == newNewsId)));
    });

    /// <summary>
    /// A comment on the seeded problem or the seeded news article reads back from that thread.
    /// </summary>
    [Fact]
    public Task CreateCommentAsync_LandsInProblemAndNewsThreads() => RunTestAsync(async commentService =>
    {
        // The seeded article's thread
        var newsThread = new CommentTarget(CommentTargetType.News, NewsId);

        // The first user comments on the problem
        await commentService.CreateCommentAsync(_problemThread, _user1, "Problem comment");

        // The first user comments on the news article
        await commentService.CreateCommentAsync(newsThread, _user1, "News comment");

        // The problem's thread
        var problemComments = await commentService.GetCommentsAsync(_problemThread, _user1);

        // Holding just the problem's comment
        Assert.Equal("Problem comment", Assert.Single(problemComments).Content);

        // The article's thread
        var newsComments = await commentService.GetCommentsAsync(newsThread, _user1);

        // Holding just the article's comment
        Assert.Equal("News comment", Assert.Single(newsComments).Content);
    });

    /// <summary>
    /// Counts come back per news article or handout, and only for those that have comments. Each type counts through
    /// a query of its own.
    /// </summary>
    /// <param name="targetType">The type of the targets counted.</param>
    [Theory]
    [InlineData(CommentTargetType.News)]
    [InlineData(CommentTargetType.Handout)]
    public Task GetCommentCountsAsync_CountsEachTarget(CommentTargetType targetType) =>
        RunTestAsync(async commentService =>
        {
            // Three targets' content ids
            var id1 = "target-1";
            var id2 = "target-2";
            var id3 = "target-3";

            // Two comments on the first target
            await commentService.CreateCommentAsync(new CommentTarget(targetType, id1), _user1, "c1");
            await commentService.CreateCommentAsync(new CommentTarget(targetType, id1), _user2, "c2");

            // One comment on the second target
            await commentService.CreateCommentAsync(new CommentTarget(targetType, id2), _user1, "c3");

            // The counts for all three, read signed out
            var counts = await commentService.GetCommentCountsAsync(targetType, [id1, id2, id3], null);

            // Each commented target's count
            Assert.Equal(2, counts[id1]);
            Assert.Equal(1, counts[id2]);

            // The uncommented target left out
            Assert.Equal(2, counts.Count);
            Assert.False(counts.ContainsKey(id3));
        });

    /// <summary>
    /// Problems are never counted in bulk: a count is refused as though the problems were not there, even to a
    /// signed-out caller, who can reach every public thread.
    /// </summary>
    [Fact]
    public Task GetCommentCountsAsync_RefusesProblems() => RunTestAsync(async commentService =>
    {
        // The seeded problem's count, asked for signed out
        await Assert.ThrowsAsync<CommentTargetNotFoundException>(
            () => commentService.GetCommentCountsAsync(CommentTargetType.Problem, [ProblemSlug], null));
    });

    /// <summary>
    /// A deleted comment takes no reaction, refused like a comment that is not there, so a page left open since the
    /// delete can't hang a reaction on the blanked stub.
    /// </summary>
    [Fact]
    public Task PressReactionAsync_RefusesADeletedComment() => RunTestAsync(async commentService =>
    {
        // The first user's comment
        var comment = await commentService.CreateCommentAsync(_handoutThread, _user1, "Soon gone");

        // The author deletes it
        await commentService.DeleteCommentAsync(comment.Id, _user1);

        // The second user gives it a thumbs-up, refused
        await Assert.ThrowsAsync<CommentNotFoundException>(
            () => commentService.PressReactionAsync(comment.Id, _user2, CommentReactionKind.ThumbsUp));
    });

    /// <summary>
    /// A deleted comment takes no reply, refused like a comment that is not there, so a page left open since the
    /// delete can't hang a reply under the blanked stub.
    /// </summary>
    [Fact]
    public Task CreateCommentAsync_RefusesAReplyToADeletedComment() => RunTestAsync(async commentService =>
    {
        // The first user's comment
        var comment = await commentService.CreateCommentAsync(_handoutThread, _user1, "Soon gone");

        // The author deletes it
        await commentService.DeleteCommentAsync(comment.Id, _user1);

        // The second user replies to it, refused
        await Assert.ThrowsAsync<CommentNotFoundException>(
            () => commentService.CreateCommentAsync(_handoutThread, _user2, "Too late", comment.Id));
    });

    /// <summary>
    /// A deleted comment keeps its place in the thread, its text blanked.
    /// </summary>
    [Fact]
    public Task GetCommentsAsync_ReturnsDeletedCommentsWithEmptyContent() => RunTestAsync(async commentService =>
    {
        // The first user's comment
        var comment = await commentService.CreateCommentAsync(_handoutThread, _user1, "Original content");

        // The author deletes the comment
        await commentService.DeleteCommentAsync(comment.Id, _user1);

        // The thread as the author reads it
        var thread = await commentService.GetCommentsAsync(_handoutThread, _user1);

        // The comment still there, marked deleted
        var root = Assert.Single(thread);
        Assert.True(root.IsDeleted);

        // The comment's text blanked
        Assert.Equal(string.Empty, root.Content);
    });

    /// <summary>
    /// A count takes only live comments: a deleted one drops out, and an edited one counts once, its replaced
    /// version being <see cref="CommentStatus.Superseded"/>.
    /// </summary>
    [Fact]
    public Task GetCommentCountsAsync_OnlyCountsActiveComments() => RunTestAsync(async commentService =>
    {
        // A news article's content id
        var id = "test-count-active";

        // The article's thread
        var target = new CommentTarget(CommentTargetType.News, id);

        // A comment left as written
        await commentService.CreateCommentAsync(target, _user1, "Active 1");

        // A comment its author will edit
        var edited = await commentService.CreateCommentAsync(target, _user1, "Active 2");

        // A comment its author will delete
        var deleted = await commentService.CreateCommentAsync(target, _user2, "Will be deleted");

        // The second user deletes that comment
        await commentService.DeleteCommentAsync(deleted.Id, _user2);

        // The first user edits the other
        await commentService.UpdateCommentAsync(edited.Id, _user1, "Updated 2");

        // The article's count, read signed out
        var counts = await commentService.GetCommentCountsAsync(CommentTargetType.News, [id], null);

        // The comment as written and the edit's new version
        Assert.Equal(2, counts[id]);
    });

    /// <summary>
    /// A problem of a running hosted round has no thread, so reading and writing are refused like a thread that is
    /// not there, and so is editing a comment already standing on the problem. The round's slugs are guessable, so
    /// an open thread would let anybody post a hint mid-round and anybody read it.
    /// </summary>
    [Fact]
    public Task HostedProblemThread_IsRefusedToReadAndWrite() => RunTestAsync(async commentService =>
    {
        // A comment by the first user already standing on the hosted problem
        var standing = new Comment
        {
            AuthorId = _user1Id,
            Content = "Try induction.",
            Status = CommentStatus.Active,
            CreatedAt = DateTimeOffset.UtcNow
        };

        // The comment written straight into the database
        await QueryAsync(async context =>
        {
            // The comment
            context.Comments.Add(standing);

            // The comment's link to the hosted problem
            context.ProblemComments.Add(new ProblemComment { ProblemId = _hostedProblemId, CommentId = standing.Id });

            // Save the comment and its link
            await context.SaveChangesAsync();
        });

        // A signed-out reader reads the hosted problem's thread
        await Assert.ThrowsAsync<CommentTargetNotFoundException>(
            () => commentService.GetCommentsAsync(_hostedThread, null));

        // The second user posts a hint in the hosted problem's thread
        await Assert.ThrowsAsync<CommentTargetNotFoundException>(
            () => commentService.CreateCommentAsync(_hostedThread, _user2, "The answer is 42."));

        // The first user edits the standing comment
        await Assert.ThrowsAsync<CommentNotFoundException>(
            () => commentService.UpdateCommentAsync(standing.Id, _user1, "Try strong induction."));
    });

    /// <inheritdoc />
    protected override async Task SeedDataAsync(MathCompsDbContext context)
    {
        // The seeded news article
        context.NewsArticles.Add(new NewsArticle
        {
            Id = Guid.NewGuid(),
            ContentId = NewsId
        });

        // The users who comment, the first with an avatar
        context.Users.AddRange(
            new User
            {
                Id = _user1Id,
                ExternalId = User1ExternalId,
                Username = "User 1",
                Email = "user1@example.com",
                AvatarUrl = User1AvatarUrl,
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            },
            new User
            {
                Id = _user2Id,
                ExternalId = User2ExternalId,
                Username = "User 2",
                Email = "user2@example.com",
                AvatarUrl = null,
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            });

        // The season the round sits in
        var season = new Season
        {
            Id = Guid.NewGuid(),
            StartYear = 2024,
            EditionNumber = 1
        };
        context.Seasons.Add(season);

        // A round of a test competition, for the problem to sit in
        var round = new Round
        {
            Id = Guid.NewGuid(),
            CompetitionId = CompetitionTreeSeed.Chain(context, "testcomp-testround").Id,
            SeasonId = season.Id,
            Date = DateOnly.FromDateTime(DateTime.Today)
        };
        context.Rounds.Add(round);

        // The problem whose thread the problem tests write in
        var problem = new Problem
        {
            RoundId = round.Id,
            Number = 1,
            Slug = ProblemSlug
        };
        context.Problems.Add(problem);

        // A hosted group whose round runs now, opened yesterday and closing tomorrow
        var group = NewGroup(
            context, "mc-running", DateTimeOffset.UtcNow.AddDays(-1), DateTimeOffset.UtcNow.AddDays(1));

        // The group's round, holding the hosted problem
        NewRound(context, season, group, Guid.CreateVersion7(), "mathcomps-advanced-october", _hostedProblemId);

        // Save the seed
        await context.SaveChangesAsync();
    }

    /// <summary>
    /// Gives the first user a username of their own.
    /// </summary>
    /// <param name="username">The username they take.</param>
    /// <returns>A task completing once the username is saved.</returns>
    private Task NameTheAuthorAsync(string username) => QueryAsync(async context =>
    {
        // The author's row
        var user = await context.Users.SingleAsync(user => user.Id == _user1Id);

        // Renamed
        user.Username = username;

        // Save the rename
        await context.SaveChangesAsync();
    });
}

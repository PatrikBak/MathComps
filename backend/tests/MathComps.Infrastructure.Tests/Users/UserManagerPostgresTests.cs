using Clerk.BackendAPI;
using MathComps.Domain.Contracts.Users;
using MathComps.Infrastructure.Extensions;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Clerk;
using MathComps.Infrastructure.Services.Users;
using MathComps.Infrastructure.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace MathComps.Infrastructure.Tests.Users;

/// <summary>
/// Integration tests for the EF-backed <see cref="IUserManager"/> against a real PostgreSQL database, with a Clerk
/// client nothing calls (no live upstream): the sync that brings a user in and brings them back, what it writes and
/// what it must leave alone across a resync (every column Clerk does not own), the lookup that answers from the
/// database rather than upstream, the acknowledgement's read and write, and the deletion that strips a user while
/// leaving the row everything they authored points at, which no later sync undoes.
/// </summary>
/// <param name="fixture">The shared PostgreSQL container fixture.</param>
public class UserManagerPostgresTests(PostgresContainerFixture fixture)
    : PostgresTestBase<IUserManager>(fixture)
{
    /// <inheritdoc/>
    protected override void ConfigureServices(IServiceCollection services)
    {
        // A Clerk client the tests never call, since they drive the paths that read only the database. Registered
        // ahead of the module below, whose own registration defers to it and so never demands a real secret.
        services.AddScoped(_ => new ClerkBackendApi(bearerAuth: "test-secret-key"));

        // Register the user services module the test resolves from
        services.AddUserServices();
    }

    /// <inheritdoc/>
    protected override Task SeedDataAsync(MathCompsDbContext context) =>
        // Each test brings its own user through the sync path under test
        Task.CompletedTask;

    /// <summary>
    /// The Clerk id of the user the first-sync test syncs.
    /// </summary>
    private const string CreateExternalId = "user_create";

    /// <summary>
    /// The Clerk id of the user the lookup test syncs.
    /// </summary>
    private const string LookupExternalId = "user_lookup";

    /// <summary>
    /// The Clerk id of the user the resync test syncs.
    /// </summary>
    private const string ResyncExternalId = "user_resync";

    /// <summary>
    /// The Clerk id of the user the unset-acknowledgement test syncs.
    /// </summary>
    private const string UntoldExternalId = "user_untold";

    /// <summary>
    /// The Clerk id of the user the acknowledgement-stamp test syncs.
    /// </summary>
    private const string StampExternalId = "user_stamp";

    /// <summary>
    /// The Clerk id of the user the repeat-acknowledgement test syncs.
    /// </summary>
    private const string RepeatExternalId = "user_repeat";

    /// <summary>
    /// The Clerk id of the user the deletion test syncs.
    /// </summary>
    private const string DeleteExternalId = "user_delete";

    /// <summary>
    /// The Clerk id of the user the late-update test syncs.
    /// </summary>
    private const string LateExternalId = "user_late";

    /// <summary>
    /// A moment far enough from now that a second write over it could not be mistaken for the first.
    /// </summary>
    private static readonly DateTimeOffset _firstToldAt = new(2026, 1, 2, 3, 4, 5, TimeSpan.Zero);

    /// <summary>
    /// A moment the site recorded something about a user at, far enough from now that no sync could have written it.
    /// </summary>
    private static readonly DateTimeOffset _stampedAt = new(2026, 2, 3, 4, 5, 6, TimeSpan.Zero);

    /// <summary>
    /// A first sync writes the user as Clerk described them: the address to reach them at and their picture.
    /// </summary>
    [Fact]
    public Task SyncUserAsync_WritesWhatClerkSentAboutANewUser() => RunTestAsync(async service =>
    {
        // Someone signs in for the first time
        var userId = await service.SyncUserAsync(new UserSyncDto(
            CreateExternalId, "create@example.com", "https://example.com/created.png"));

        // The row the sync wrote
        var user = await QueryValueAsync(context => context.Users.SingleAsync(user => user.Id == userId));

        // It carries them as Clerk described them
        Assert.Equal(CreateExternalId, user.ExternalId);
        Assert.Equal("create@example.com", user.Email);
        Assert.Equal("https://example.com/created.png", user.AvatarUrl);

        // And as a live user rather than a deleted one
        Assert.False(user.IsDeleted);
    });

    /// <summary>
    /// Re-syncing a user brings in what Clerk owns, the address and the picture, and leaves every column the student
    /// said or the site recorded as it stood. The row keeps its id, which everything the user authored points at, and
    /// its join moment. It runs for a student at school and one past it, since being past school clears the year.
    /// </summary>
    /// <param name="graduationYear">The year the student gives, held only while they are still at school.</param>
    /// <param name="hasLeftHighSchool">Whether the student says they are past school, which clears the year.</param>
    [Theory]
    [InlineData(2027, false)]
    [InlineData(null, true)]
    public Task SyncUserAsync_WritesOnlyWhatClerkOwnsAcrossAResync(int? graduationYear, bool hasLeftHighSchool) =>
        RunTestAsync(async service =>
        {
            // A synced user
            var userId = await service.SyncUserAsync(new UserSyncDto(ResyncExternalId, "before@example.com", null));

            // Who has taken a name
            await service.SetUsernameAsync(userId, "keeper");

            // And said where and when they compete
            await service.UpdateProfileAsync(
                userId, new UpdateUserProfileRequest(graduationYear, hasLeftHighSchool, "SK"));

            // Whom the site has recorded as told about Mathilda, as having accepted the rules and as having hidden
            // the profile prompt
            await QueryAsync(context => context.Users
                .Where(user => user.Id == userId)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(user => user.ConsentedToAiAt, _stampedAt)
                    .SetProperty(user => user.RulesAcceptedAt, _stampedAt)
                    .SetProperty(user => user.ProfilePromptDismissedAt, _stampedAt)));

            // The row as the student and the site left it
            var before = await QueryValueAsync(context => context.Users.SingleAsync(user => user.Id == userId));

            // Clerk sends the same user along again, with a new address and picture
            var resyncedId = await service.SyncUserAsync(
                new UserSyncDto(ResyncExternalId, "after@example.com", "https://example.com/after.png"));

            // The same row answered
            Assert.Equal(userId, resyncedId);

            // The row as the resync left it
            var after = await QueryValueAsync(context => context.Users.SingleAsync(user => user.Id == userId));

            // It took what Clerk sent, and its last-updated moment moved on
            Assert.Equal("after@example.com", after.Email);
            Assert.Equal("https://example.com/after.png", after.AvatarUrl);
            Assert.True(after.UpdatedAt > before.UpdatedAt);

            // Still dated from when they joined
            Assert.Equal(before.CreatedAt, after.CreatedAt);

            // What the student said still stands
            Assert.Equal("keeper", after.Username);
            Assert.Equal(graduationYear, after.GraduationYear);
            Assert.Equal(hasLeftHighSchool, after.HasLeftHighSchool);
            Assert.Equal("SK", after.CountryCode);

            // And so does what the site recorded of them
            Assert.Equal(_stampedAt, after.ConsentedToAiAt);
            Assert.Equal(_stampedAt, after.RulesAcceptedAt);
            Assert.Equal(_stampedAt, after.ProfilePromptDismissedAt);
        });

    /// <summary>
    /// Looking up a user we already hold is answered from the database. The lookup falls back to fetching them from
    /// Clerk when no row answers, and that fallback would fail here against a made-up secret key.
    /// </summary>
    [Fact]
    public Task GetUserIdAsync_AnswersFromTheDatabaseForASyncedUser() => RunTestAsync(async service =>
    {
        // A user the sync path has already brought in
        var userId = await service.SyncUserAsync(
            new UserSyncDto(LookupExternalId, "lookup@example.com", null));

        // Something holding only their Clerk id asks who they are
        var foundId = await service.GetUserIdAsync(LookupExternalId);

        // The same user, without a trip upstream
        Assert.Equal(userId, foundId);
    });

    /// <summary>
    /// The acknowledgement reads as absent until the user gives it, for a user we hold and for an id no row answers
    /// alike, since whoever is behind neither has been told anything.
    /// </summary>
    [Fact]
    public Task GetAiConsentAsync_AnswersNullUntilTheUserIsTold() => RunTestAsync(async service =>
    {
        // A synced user who has yet to meet Mathilda
        var userId = await service.SyncUserAsync(
            new UserSyncDto(UntoldExternalId, "untold@example.com", null));

        // The gate asks whether they have been told
        var consentedAt = await service.GetAiConsentAsync(userId);

        // Nothing to show for them
        Assert.Null(consentedAt);

        // Nor for an id with no row behind it
        Assert.Null(await service.GetAiConsentAsync(Guid.NewGuid()));
    });

    /// <summary>
    /// Acknowledging stamps the moment it happened, which is the only record that the user was ever told what talking
    /// to Mathilda entails.
    /// </summary>
    [Fact]
    public Task RecordAiConsentAsync_StampsTheMomentTheUserWasTold() => RunTestAsync(async service =>
    {
        // A synced user who has yet to meet Mathilda
        var userId = await service.SyncUserAsync(
            new UserSyncDto(StampExternalId, "stamp@example.com", null));

        // The moment just before they acknowledge, at the precision the database keeps
        var before = DateTimeOffset.UtcNow.TruncateToMicroseconds();

        // They acknowledge it
        await service.RecordAiConsentAsync(userId);

        // The stamp that went down
        var consentedAt = await service.GetAiConsentAsync(userId);

        // It sits inside the window the acknowledgement happened in
        Assert.NotNull(consentedAt);
        Assert.InRange(consentedAt.Value, before, DateTimeOffset.UtcNow);
    });

    /// <summary>
    /// Acknowledging a second time leaves the first moment standing, which is what makes the stamp mean when the user
    /// was first told rather than when they last clicked.
    /// </summary>
    [Fact]
    public Task RecordAiConsentAsync_KeepsTheMomentTheUserWasFirstTold() => RunTestAsync(async service =>
    {
        // A synced user
        var userId = await service.SyncUserAsync(
            new UserSyncDto(RepeatExternalId, "repeat@example.com", null));

        // Who has acknowledged what talking to Mathilda entails
        await service.RecordAiConsentAsync(userId);

        // Backdate the stamp, so a second write lands far enough away to be unmistakable rather than a tick apart
        await QueryAsync(context => context.Users
            .Where(user => user.Id == userId)
            .ExecuteUpdateAsync(setters => setters.SetProperty(user => user.ConsentedToAiAt, _firstToldAt)));

        // They acknowledge it a second time
        await service.RecordAiConsentAsync(userId);

        // The record still says when they were first told
        Assert.Equal(_firstToldAt, await service.GetAiConsentAsync(userId));
    });

    /// <summary>
    /// Deleting a user strips their personal information but leaves the row in place. Everything they authored points
    /// at that row, so removing it would take their comments and defense conversations with it.
    /// </summary>
    [Fact]
    public Task DeleteUserAsync_AnonymizesTheUserAndKeepsTheRow() => RunTestAsync(async service =>
    {
        // A synced user carrying every piece of personal information Clerk sends
        var userId = await service.SyncUserAsync(
            new UserSyncDto(DeleteExternalId, "delete@example.com", "https://example.com/avatar.png"));

        // Clerk reports the account gone
        await service.DeleteUserAsync(DeleteExternalId);

        // The row is still there
        var user = await QueryValueAsync(context => context.Users.SingleAsync(user => user.Id == userId));

        // Flagged as deleted, and stripped of what Clerk supplied
        Assert.True(user.IsDeleted);
        Assert.Null(user.Email);
        Assert.Null(user.AvatarUrl);
    });

    /// <summary>
    /// Re-syncing a deleted user leaves the deletion standing. Clerk can deliver an update after the deletion, and
    /// writing it would bring back the address and the picture the deletion stripped.
    /// </summary>
    [Fact]
    public Task SyncUserAsync_LeavesADeletedUserAsTheDeletionLeftThem() => RunTestAsync(async service =>
    {
        // A synced user
        var userId = await service.SyncUserAsync(new UserSyncDto(LateExternalId, "late@example.com", null));

        // Whom Clerk reports gone
        await service.DeleteUserAsync(LateExternalId);

        // And then sends them along once more, in an update that arrived after the deletion
        var resyncedId = await service.SyncUserAsync(
            new UserSyncDto(LateExternalId, "late@example.com", "https://example.com/late.png"));

        // The same row answered
        Assert.Equal(userId, resyncedId);

        // The row as the late update left it
        var user = await QueryValueAsync(context => context.Users.SingleAsync(user => user.Id == userId));

        // Still deleted, and still stripped
        Assert.True(user.IsDeleted);
        Assert.Null(user.Email);
        Assert.Null(user.AvatarUrl);
    });

    /// <summary>
    /// A deletion for an account we hold nothing on passes quietly. Clerk delivers deletions over a webhook it
    /// retries on failure, so throwing at an account that never reached us would loop.
    /// </summary>
    [Fact]
    public Task DeleteUserAsync_PassesQuietlyOverAnAccountWeNeverSynced() => RunTestAsync(async service =>
    {
        // Clerk reports an account gone that never signed in here
        await service.DeleteUserAsync("user_never_synced");

        // Nothing was written to stand in for them
        Assert.Empty(await QueryValueAsync(context => context.Users.ToListAsync()));
    });
}

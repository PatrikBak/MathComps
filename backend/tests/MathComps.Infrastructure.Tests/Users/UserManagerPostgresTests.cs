using Clerk.BackendAPI;
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
/// what it must leave alone across a resync (the row's id, the moment they joined, their AI acknowledgement), the
/// lookup that answers from the database rather than upstream, the acknowledgement's read and write, and the deletion
/// that strips a user while leaving the row everything they authored points at.
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
    /// The Clerk id of the user the row-identity test syncs.
    /// </summary>
    private const string IdentityExternalId = "user_identity";

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
    /// A moment far enough from now that a second write over it could not be mistaken for the first.
    /// </summary>
    private static readonly DateTimeOffset _firstToldAt = new(2026, 1, 2, 3, 4, 5, TimeSpan.Zero);

    /// <summary>
    /// A first sync writes the user as Clerk described them, which is what the site shows next to anything they
    /// later author.
    /// </summary>
    [Fact]
    public Task SyncUserAsync_WritesWhatClerkSentAboutANewUser() => RunTestAsync(async service =>
    {
        // Someone signs in for the first time
        var userId = await service.SyncUserAsync(new UserSyncDto(
            CreateExternalId, "create@example.com", "Created", "https://example.com/created.png"));

        // The row the sync wrote
        var user = await QueryValueAsync(context => context.Users.SingleAsync(user => user.Id == userId));

        // It carries them as Clerk described them
        Assert.Equal(CreateExternalId, user.ExternalId);
        Assert.Equal("create@example.com", user.Email);
        Assert.Equal("Created", user.DisplayName);
        Assert.Equal("https://example.com/created.png", user.AvatarUrl);

        // And as a live user rather than a deleted one
        Assert.False(user.IsDeleted);
    });

    /// <summary>
    /// Re-syncing a user keeps the row's identity: everything they authored points at that id, and the creation
    /// moment says when they joined rather than when Clerk last sent them along.
    /// </summary>
    [Fact]
    public Task SyncUserAsync_KeepsTheIdAndJoinMomentAcrossAResync() => RunTestAsync(async service =>
    {
        // A synced user
        var userId = await service.SyncUserAsync(
            new UserSyncDto(IdentityExternalId, "identity@example.com", "Before", null));

        // The moment the row records them joining
        var createdAt = await QueryValueAsync(context => context.Users
            .Where(user => user.Id == userId)
            .Select(user => user.CreatedAt)
            .SingleAsync());

        // Clerk sends the same user along again, with a changed display name
        var resyncedId = await service.SyncUserAsync(
            new UserSyncDto(IdentityExternalId, "identity@example.com", "After", null));

        // The same row answered
        Assert.Equal(userId, resyncedId);

        // The row as the resync left it
        var user = await QueryValueAsync(context => context.Users.SingleAsync(user => user.Id == userId));

        // Still dated from when they joined
        Assert.Equal(createdAt, user.CreatedAt);
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
            new UserSyncDto(LookupExternalId, "lookup@example.com", "Lookup", null));

        // Something holding only their Clerk id asks who they are
        var foundId = await service.GetUserIdAsync(LookupExternalId);

        // The same user, without a trip upstream
        Assert.Equal(userId, foundId);
    });

    /// <summary>
    /// Re-syncing a user from Clerk leaves their AI acknowledgement standing. The sync upserts the whole row from an
    /// entity Clerk carries no acknowledgement for, so a column not excluded from that write is silently blanked
    /// every time the user edits their name or avatar upstream.
    /// </summary>
    [Fact]
    public Task SyncUserAsync_KeepsAiConsentAcrossAResync() => RunTestAsync(async service =>
    {
        // A synced user
        var userId = await service.SyncUserAsync(
            new UserSyncDto(ResyncExternalId, "resync@example.com", "Before", null));

        // Who has since acknowledged what talking to Mathilda entails
        await service.RecordAiConsentAsync(userId);

        // The same user comes back from Clerk with a changed display name
        await service.SyncUserAsync(
            new UserSyncDto(ResyncExternalId, "resync@example.com", "After", null));

        // The row as the resync left it
        var user = await QueryValueAsync(context => context.Users.SingleAsync(user => user.Id == userId));

        // The upsert landed
        Assert.Equal("After", user.DisplayName);

        // And it left the acknowledgement alone
        Assert.NotNull(user.ConsentedToAiAt);
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
            new UserSyncDto(UntoldExternalId, "untold@example.com", "Untold", null));

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
            new UserSyncDto(StampExternalId, "stamp@example.com", "Stamp", null));

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
            new UserSyncDto(RepeatExternalId, "repeat@example.com", "Repeat", null));

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
            new UserSyncDto(DeleteExternalId, "delete@example.com", "Deleted Me", "https://example.com/avatar.png"));

        // Clerk reports the account gone
        await service.DeleteUserAsync(DeleteExternalId);

        // The row is still there
        var user = await QueryValueAsync(context => context.Users.SingleAsync(user => user.Id == userId));

        // Flagged as deleted, and stripped of anything identifying
        Assert.True(user.IsDeleted);
        Assert.Null(user.Email);
        Assert.Null(user.AvatarUrl);
        Assert.NotEqual("Deleted Me", user.DisplayName);
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

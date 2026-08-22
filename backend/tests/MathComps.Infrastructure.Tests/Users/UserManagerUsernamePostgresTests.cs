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
/// Integration tests for taking a username against a real PostgreSQL database: the rules a name has to keep, the
/// uniqueness the index enforces whatever the name was capitalized as, the permanence that results hang off, and
/// the resync that must not carry a name away.
/// </summary>
/// <param name="fixture">The shared PostgreSQL container fixture.</param>
public class UserManagerUsernamePostgresTests(PostgresContainerFixture fixture)
    : PostgresTestBase<IUserManager>(fixture)
{
    /// <inheritdoc/>
    protected override void ConfigureServices(IServiceCollection services)
    {
        // A Clerk client the tests never call, since taking a username never leaves the database
        services.AddScoped(_ => new ClerkBackendApi(bearerAuth: "test-secret-key"));

        // Register the user services module the test resolves from
        services.AddUserServices();
    }

    /// <inheritdoc/>
    protected override Task SeedDataAsync(MathCompsDbContext context) =>
        // Each test brings its own user through the sync path
        Task.CompletedTask;

    /// <summary>
    /// A name that is taken is what the site calls the user from then on.
    /// </summary>
    [Fact]
    public Task SetUsernameAsync_TakesTheName() => RunTestAsync(async service =>
    {
        // A synced user with no name of their own yet
        var userId = await service.SyncUserAsync(new UserSyncDto("user_take", "take@example.com", "Take", null));

        // They choose one
        await service.SetUsernameAsync(userId, "  Peťo  Novák ");

        // The row carries it, trimmed and with the run inside it collapsed
        var profile = await service.GetProfileAsync(userId);
        Assert.Equal("Peťo Novák", profile?.Username);
    });

    /// <summary>
    /// A second user cannot take a name the first already answers to, however either of them capitalized it. The
    /// uniqueness is an index over the folded form, so a check that only compared the raw strings would let both
    /// through and leave two people sharing an identity that results hang off.
    /// </summary>
    [Fact]
    public Task SetUsernameAsync_RefusesANameSomebodyElseHoldsInAnotherCasing() => RunTestAsync(async service =>
    {
        // One user who has taken a name
        var firstId = await service.SyncUserAsync(new UserSyncDto("user_first", "first@example.com", "First", null));
        await service.SetUsernameAsync(firstId, "Kocurkovo");

        // And another reaching for the same one, shouted
        var secondId = await service.SyncUserAsync(new UserSyncDto("user_second", "second@example.com", "Second", null));

        // Who is turned away
        await Assert.ThrowsAsync<UsernameTakenException>(() => service.SetUsernameAsync(secondId, "KOCURKOVO"));

        // With nothing written for them
        var profile = await service.GetProfileAsync(secondId);
        Assert.Null(profile?.Username);
    });

    /// <summary>
    /// A name cannot be exchanged for another. Results and standings hang off it, so a name that could be
    /// rewritten would have to be snapshotted everywhere it has ever been shown.
    /// </summary>
    [Fact]
    public Task SetUsernameAsync_RefusesToChangeANameAlreadyTaken() => RunTestAsync(async service =>
    {
        // A user who has chosen
        var userId = await service.SyncUserAsync(new UserSyncDto("user_again", "again@example.com", "Again", null));
        await service.SetUsernameAsync(userId, "settled");

        // Having second thoughts
        await Assert.ThrowsAsync<UsernameAlreadySetException>(() => service.SetUsernameAsync(userId, "different"));

        // The first name stands
        var profile = await service.GetProfileAsync(userId);
        Assert.Equal("settled", profile?.Username);
    });

    /// <summary>
    /// Names that break a rule are refused. The client checks the same rules, so this is what stops a caller that
    /// skipped the form from writing a name nobody could have typed.
    /// </summary>
    /// <param name="username">A name that must not be taken.</param>
    [Theory]
    [InlineData("ab")]
    [InlineData("this-name-is-far-too-long")]
    [InlineData("peto.novak")]
    [InlineData("peto@novak")]
    [InlineData("\U0001D40F\U0001D41E\U0001D42D\U0001D428")]
    [InlineData("   ")]
    public Task SetUsernameAsync_RefusesANameThatBreaksTheRules(string username) => RunTestAsync(async service =>
    {
        // A user with no name yet
        var userId = await service.SyncUserAsync(
            new UserSyncDto($"user_bad_{username.GetHashCode():X}", "bad@example.com", "Bad", null));

        // Who tries one that cannot be had
        await Assert.ThrowsAsync<UsernameRejectedException>(() => service.SetUsernameAsync(userId, username));
    });

    /// <summary>
    /// A request that carried no name at all is refused like any other bad name. The request record declares the
    /// field non-nullable, but nothing enforces that at deserialization, so a hand-rolled body reaches here with
    /// null and must not come back as a fault.
    /// </summary>
    [Fact]
    public Task SetUsernameAsync_RefusesANameThatWasNeverSent() => RunTestAsync(async service =>
    {
        // A user with no name yet
        var userId = await service.SyncUserAsync(new UserSyncDto("user_null", "null@example.com", "Null", null));

        // Who sends a body with nothing in it
        await Assert.ThrowsAsync<UsernameRejectedException>(() => service.SetUsernameAsync(userId, null!));
    });

    /// <summary>
    /// Deleting an account leaves the name reserved. Anonymizing the row would hand the name back to whoever
    /// asks next, and results that already carry it would then read as somebody else's. What stops a deleted
    /// account still being named is the comment author projection, not this.
    /// </summary>
    [Fact]
    public Task DeleteUserAsync_LeavesTheUsernameReserved() => RunTestAsync(async service =>
    {
        // A user who has taken a name
        var userId = await service.SyncUserAsync(new UserSyncDto("user_gone", "gone@example.com", "Gone", null));
        await service.SetUsernameAsync(userId, "Peťo Novák");

        // Who then leaves
        await service.DeleteUserAsync("user_gone");

        // The name Clerk supplied is scrubbed, and the one holding the index is not
        var user = await QueryValueAsync(context => context.Users.SingleAsync(user => user.Id == userId));
        Assert.Equal("Deleted User", user.DisplayName);
        Assert.Equal("Peťo Novák", user.Username);
    });

    /// <summary>
    /// Re-syncing a user from Clerk leaves their username standing. The sync upserts the whole row from an entity
    /// Clerk carries no username for, so a column not excluded from that write is silently blanked every time the
    /// user edits their name or avatar upstream, which would hand a permanent identity back to whoever asks next.
    /// </summary>
    [Fact]
    public Task SyncUserAsync_KeepsTheUsernameAcrossAResync() => RunTestAsync(async service =>
    {
        // A synced user who has taken a name
        var userId = await service.SyncUserAsync(new UserSyncDto("user_keep", "keep@example.com", "Before", null));
        await service.SetUsernameAsync(userId, "keeper");

        // The same user comes back from Clerk with a changed display name
        await service.SyncUserAsync(new UserSyncDto("user_keep", "keep@example.com", "After", null));

        // The upsert landed
        var user = await QueryValueAsync(context => context.Users.SingleAsync(user => user.Id == userId));
        Assert.Equal("After", user.DisplayName);

        // And it left the name alone
        Assert.Equal("keeper", user.Username);
    });
}

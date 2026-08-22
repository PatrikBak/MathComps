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
/// Integration tests for what a student says about their competing against a real PostgreSQL database: that
/// every field round-trips, that clearing one is a thing they can do, that a year and a school left cannot both
/// stand, that a code which is not a country is refused, that the address Clerk sent reads back with it, and
/// that a resync from Clerk carries none of it away.
/// </summary>
/// <param name="fixture">The shared PostgreSQL container fixture.</param>
public class UserManagerProfilePostgresTests(PostgresContainerFixture fixture)
    : PostgresTestBase<IUserManager>(fixture)
{
    /// <inheritdoc/>
    protected override void ConfigureServices(IServiceCollection services)
    {
        // A Clerk client the tests never call, since saying where you compete from never leaves the database
        services.AddScoped(_ => new ClerkBackendApi(bearerAuth: "test-secret-key"));

        // Register the user services module the test resolves from
        services.AddUserServices();
    }

    /// <inheritdoc/>
    protected override Task SeedDataAsync(MathCompsDbContext context) =>
        // Each test brings its own user through the sync path
        Task.CompletedTask;

    /// <summary>
    /// A year and a country come back as they were given, with the country stored uppercase whatever the
    /// caller typed, so two spellings of one country are one value.
    /// </summary>
    [Fact]
    public Task UpdateProfileAsync_KeepsBothFields() => RunTestAsync(async service =>
    {
        // A synced user who has said nothing yet
        var userId = await service.SyncUserAsync(new UserSyncDto("user_says", "says@example.com", null));

        // Who says where and when they compete
        await service.UpdateProfileAsync(userId, new UpdateUserProfileRequest(DateTimeOffset.UtcNow.Year, false, "sk"));

        // Read back what stands
        var profile = await service.GetProfileAsync(userId);

        // Both stand, the country folded to one spelling
        Assert.Equal(DateTimeOffset.UtcNow.Year, profile?.GraduationYear);
        Assert.Equal("SK", profile?.CountryCode);
    });

    /// <summary>
    /// The profile carries the address as well as the name, so one read answers everything about the user.
    /// </summary>
    [Fact]
    public Task GetProfileAsync_CarriesTheAddressClerkSent() => RunTestAsync(async service =>
    {
        // A synced user who has said nothing yet
        var userId = await service.SyncUserAsync(new UserSyncDto("user_mail", "mail@example.com", null));

        // Read back what stands
        var profile = await service.GetProfileAsync(userId);

        // The address came back with the profile
        Assert.Equal("mail@example.com", profile?.Email);
    });

    /// <summary>
    /// Saying nothing clears what was said before, since the request replaces every field rather than patching
    /// the one that moved.
    /// </summary>
    [Fact]
    public Task UpdateProfileAsync_ClearsWhatWasSaidBefore() => RunTestAsync(async service =>
    {
        // A synced user
        var userId = await service.SyncUserAsync(new UserSyncDto("user_undo", "undo@example.com", null));

        // Who says where and when they compete
        await service.UpdateProfileAsync(userId, new UpdateUserProfileRequest(DateTimeOffset.UtcNow.Year, false, "CZ"));

        // Who then takes it back
        await service.UpdateProfileAsync(userId, new UpdateUserProfileRequest(null, false, null));

        // Read back what stands
        var profile = await service.GetProfileAsync(userId);

        // And they are back to saying nothing
        Assert.Null(profile?.GraduationYear);
        Assert.Null(profile?.CountryCode);
    });

    /// <summary>
    /// Saying you are past school puts your year down, since a year sat and a school left are not both true.
    /// </summary>
    [Fact]
    public Task UpdateProfileAsync_ClearsTheYearOfSomebodyPastSchool() => RunTestAsync(async service =>
    {
        // A synced user
        var userId = await service.SyncUserAsync(new UserSyncDto("user_past", "past@example.com", null));

        // Who gave a year
        await service.UpdateProfileAsync(userId, new UpdateUserProfileRequest(2027, false, "SK"));

        // Who then says they are past school, with the old year still riding along in the request
        await service.UpdateProfileAsync(userId, new UpdateUserProfileRequest(2027, true, "SK"));

        // Read back what stands
        var profile = await service.GetProfileAsync(userId);

        // Only one of the two does
        Assert.True(profile?.HasLeftHighSchool);
        Assert.Null(profile?.GraduationYear);
    });

    /// <summary>
    /// Anything that is not two letters is refused as a country.
    /// </summary>
    /// <param name="countryCode">A code that must not be stored.</param>
    [Theory]
    [InlineData("SVK")]
    [InlineData("S")]
    [InlineData("S1")]
    [InlineData("Slovensko")]
    public Task UpdateProfileAsync_RefusesACodeThatIsNotACountry(string countryCode) => RunTestAsync(async service =>
    {
        // A user with nothing said yet
        var userId = await service.SyncUserAsync(
            new UserSyncDto($"user_cc_{countryCode}", "cc@example.com", null));

        // Who sends something that is not an alpha-2 code
        await Assert.ThrowsAsync<ProfileValueInvalidException>(
            () => service.UpdateProfileAsync(userId, new UpdateUserProfileRequest(null, false, countryCode)));
    });

    /// <summary>
    /// Re-syncing a user from Clerk leaves every field standing. The sync upserts the whole row from an entity
    /// Clerk carries neither of them for, so a column not excluded from that write is silently blanked every
    /// time the student edits their avatar upstream.
    /// </summary>
    [Fact]
    public Task SyncUserAsync_KeepsWhatTheStudentSaidAcrossAResync() => RunTestAsync(async service =>
    {
        // A synced user
        var userId = await service.SyncUserAsync(new UserSyncDto("user_stays", "stays@example.com", null));

        // Who has said where and when they compete
        await service.UpdateProfileAsync(userId, new UpdateUserProfileRequest(DateTimeOffset.UtcNow.Year, false, "SK"));

        // The same user comes back from Clerk with a changed avatar
        await service.SyncUserAsync(
            new UserSyncDto("user_stays", "stays@example.com", "https://example.com/after.png"));

        // Read the row back
        var user = await QueryValueAsync(context => context.Users.SingleAsync(user => user.Id == userId));

        // The upsert landed
        Assert.Equal("https://example.com/after.png", user.AvatarUrl);

        // And it left every field alone
        Assert.Equal(DateTimeOffset.UtcNow.Year, user.GraduationYear);
        Assert.False(user.HasLeftHighSchool);
        Assert.Equal("SK", user.CountryCode);
    });
}

using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Extensions;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Users;
using MathComps.Infrastructure.Tests.TestInfrastructure;
using Microsoft.Extensions.DependencyInjection;

namespace MathComps.Infrastructure.Tests.Users;

/// <summary>
/// Covers <see cref="UserGrantService"/>, which is what every rule asks before letting somebody past it.
/// </summary>
/// <remarks>
/// A grant is a row, so the case that matters is the one where a row exists and still must not count: one
/// written against a different account. That would read as the capability being held if the query were a shade
/// looser, and nothing downstream re-checks.
/// </remarks>
/// <param name="fixture">The shared PostgreSQL container fixture.</param>
public class UserGrantServicePostgresTests(PostgresContainerFixture fixture)
    : PostgresTestBase<IUserGrantService>(fixture)
{
    /// <summary>
    /// The student the grant was written for.
    /// </summary>
    private readonly Guid _grantedId = Guid.CreateVersion7();

    /// <summary>
    /// A student holding no grant at all.
    /// </summary>
    private readonly Guid _plainId = Guid.CreateVersion7();

    /// <inheritdoc/>
    protected override void ConfigureServices(IServiceCollection services) =>
        // The reader under test.
        services.AddUserGrants();

    /// <summary>
    /// A standing row is read back as the capability it names. A read that missed one would shut every
    /// granted account back out of the gates it was let past.
    /// </summary>
    [Fact]
    public Task The_account_a_grant_names_holds_it() => RunTestAsync(async grants =>
        // The row the seed wrote against this account
        Assert.True(await grants.HasAsync(_grantedId, UserCapability.BypassCompetitionGates)));

    /// <summary>
    /// Every other account holds nothing, with a row for somebody else standing in the same table. That is the
    /// whole site, so a query matching one account too loosely would hand the capability to all of it.
    /// </summary>
    [Fact]
    public Task Another_students_grant_is_not_theirs() => RunTestAsync(async grants =>
        // Nothing was ever written for them
        Assert.False(await grants.HasAsync(_plainId, UserCapability.BypassCompetitionGates)));

    /// <inheritdoc/>
    protected override async Task SeedDataAsync(MathCompsDbContext context)
    {
        // The accounts the cases are asked about.
        context.Users.AddRange(
            new User { Id = _grantedId, ExternalId = "ext-granted", Username = "Granted" },
            new User { Id = _plainId, ExternalId = "ext-plain", Username = "Plain" });

        // The grant, written against the granted account and no other.
        context.UserGrants.Add(new UserGrant
        {
            UserId = _grantedId,
            Capability = UserCapability.BypassCompetitionGates,
        });

        // Submit changes
        await context.SaveChangesAsync();
    }
}

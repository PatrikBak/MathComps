using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Extensions;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Organizations;
using MathComps.Infrastructure.Tests.TestInfrastructure;
using Microsoft.Extensions.DependencyInjection;

namespace MathComps.Infrastructure.Tests.Organizations;

/// <summary>
/// Covers <see cref="OrganizationMemberService"/>: who is a member of an organization, and since when.
/// </summary>
/// <remarks>
/// Membership is an account's address matched against a list, so the cases that matter are the near misses: the same
/// address capitalized differently, which must count, and an address on another organization's list, which must not.
/// </remarks>
/// <param name="fixture">The shared PostgreSQL container fixture.</param>
public class OrganizationMemberServicePostgresTests(PostgresContainerFixture fixture)
    : PostgresTestBase<IOrganizationMemberService>(fixture)
{
    /// <summary>
    /// When the member's address was put on the list.
    /// </summary>
    private static readonly DateTimeOffset _addedAt = new(2026, 9, 1, 12, 0, 0, TimeSpan.Zero);

    /// <summary>
    /// An account whose address is on the MathComps organization's list, capitalized differently from the list.
    /// </summary>
    private readonly Guid _memberId = Guid.CreateVersion7();

    /// <summary>
    /// A second account carrying the member's address, capitalized differently again.
    /// </summary>
    private readonly Guid _twinId = Guid.CreateVersion7();

    /// <summary>
    /// An account whose address is on another organization's list alone.
    /// </summary>
    private readonly Guid _outsiderId = Guid.CreateVersion7();

    /// <summary>
    /// An account with no address, which a deleted account is left with.
    /// </summary>
    private readonly Guid _addresslessId = Guid.CreateVersion7();

    /// <inheritdoc/>
    protected override void ConfigureServices(IServiceCollection services) =>
        // The reader under test.
        services.AddOrganizationMembers();

    /// <summary>
    /// An account is a member whatever capitals its owner signed up with, from the moment its address went on the
    /// list. A match that compared the address as typed would turn away whoever typed a capital the list doesn't have.
    /// </summary>
    [Fact]
    public Task A_member_is_one_however_their_address_is_capitalized() => RunTestAsync(async members =>
    {
        // A member of MathComps
        Assert.True(await members.IsMemberAsync(_memberId, Organization.MathCompsSlug));

        // Since the address went on the list
        Assert.Equal(_addedAt, await members.GetMemberSinceAsync(_memberId, Organization.MathCompsSlug));
    });

    /// <summary>
    /// An address on one organization's list lets nobody into another. A match that read every list would let every
    /// organization's members into MathComps' pool and past its competitions' gates.
    /// </summary>
    [Fact]
    public Task An_address_on_another_organizations_list_lets_nobody_in() => RunTestAsync(async members =>
    {
        // No member of MathComps
        Assert.False(await members.IsMemberAsync(_outsiderId, Organization.MathCompsSlug));

        // With no date to be a member since
        Assert.Null(await members.GetMemberSinceAsync(_outsiderId, Organization.MathCompsSlug));
    });

    /// <summary>
    /// Asked about several accounts at once, only the members come back, each with when its address went on the list.
    /// The list holds addresses rather than accounts, so two accounts carrying one address are both members, and an
    /// account with no address matches nothing.
    /// </summary>
    [Fact]
    public Task Of_several_accounts_only_the_members_come_back() => RunTestAsync(async members =>
        // Of every account asked about, the two carrying the listed address alone, each since it went on the list
        Assert.Equal(
            new Dictionary<Guid, DateTimeOffset> { [_memberId] = _addedAt, [_twinId] = _addedAt },
            await members.GetMemberSinceAsync(
                [_memberId, _twinId, _outsiderId, _addresslessId], Organization.MathCompsSlug)));

    /// <inheritdoc/>
    protected override async Task SeedDataAsync(MathCompsDbContext context)
    {
        // The accounts the cases are asked about.
        context.Users.AddRange(
            new User { Id = _memberId, ExternalId = "ext-member", Username = "Member", Email = "Member@Example.com" },
            new User { Id = _twinId, ExternalId = "ext-twin", Username = "Twin", Email = "MEMBER@example.com" },
            new User
            {
                Id = _outsiderId,
                ExternalId = "ext-outsider",
                Username = "Outsider",
                Email = "out@example.com",
            },
            new User { Id = _addresslessId, ExternalId = "ext-addressless", Username = "Addressless" });

        // The member's address on the MathComps organization's list.
        SelectionSeed.NewMember(context, "member@example.com", _addedAt);

        // Another organization.
        var other = new Organization { Slug = "other", NeedsEveryLanguage = false };
        context.Organizations.Add(other);

        // The outsider's address on the other organization's list.
        context.OrganizationMembers.Add(new OrganizationMember
        {
            OrganizationId = other.Id,
            Email = "out@example.com",
            AddedAt = _addedAt,
        });

        // Submit changes
        await context.SaveChangesAsync();
    }
}

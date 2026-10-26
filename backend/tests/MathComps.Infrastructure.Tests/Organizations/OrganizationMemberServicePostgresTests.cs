using MathComps.Domain.Contracts.Selection;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Extensions;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Organizations;
using MathComps.Infrastructure.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace MathComps.Infrastructure.Tests.Organizations;

/// <summary>
/// Covers <see cref="OrganizationMemberService"/>: who is a member of an organization, since when, which
/// organizations an account is a member of and in what order they come, and which of an organization's categories
/// it leads.
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
    /// An account whose address is on the other organization's list alone.
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

    /// <summary>
    /// An account's organizations come back, whatever capitals its address carries: the member's two, the
    /// outsider's one, and none for an account with no address.
    /// </summary>
    [Fact]
    public Task An_accounts_organizations_come_back() => RunTestAsync(async members =>
    {
        // The member's address on the other organization's list as well
        await ListMemberOnOtherAsync();

        // The member's two
        Assert.Equal(2, (await members.GetOrganizationIdsAsync(_memberId)).Count);

        // The outsider's one
        Assert.Single(await members.GetOrganizationIdsAsync(_outsiderId));

        // And none for the account with no address
        Assert.Empty(await members.GetOrganizationIdsAsync(_addresslessId));
    });

    /// <summary>
    /// An account's organizations come back each under its own slug and name, MathComps under the name the migrations
    /// gave it, in the order of the names: the other organization, named Alpha, ahead of MathComps, which its slug
    /// would put first. A slug and a name swapped would offer each selection under its slug, at an address naming no
    /// organization.
    /// </summary>
    [Fact]
    public Task An_accounts_organizations_come_back_named() => RunTestAsync(async members =>
    {
        // The member's address on the other organization's list as well
        await ListMemberOnOtherAsync();

        // The member's two, the other organization first
        Assert.Equal(
            [new OrganizationDto("other", "Alpha"), new OrganizationDto(Organization.MathCompsSlug, "MathComps")],
            await members.GetOrganizationsAsync(_memberId));
    });

    /// <summary>
    /// The categories an account leads come back whatever capitals its address carries, and only the asked
    /// organization's. A match on the address as typed would refuse a lead the papers of the categories they lead,
    /// and one reading every organization would name another organization's categories in MathComps' selection.
    /// </summary>
    [Fact]
    public Task An_accounts_lead_categories_are_the_asked_organizations_alone() => RunTestAsync(async members =>
    {
        // The member made a lead of MathComps' elementary category, and of the other organization's one category
        var (elementaryId, otherCategoryId) = await QueryValueAsync(async context =>
        {
            // MathComps' elementary category, which the migrations create
            var elementary = await context.OrganizationCategories.SingleAsync(category =>
                category.Organization.Slug == Organization.MathCompsSlug && category.Name == "elementary");

            // The other organization
            var other = await context.Organizations.SingleAsync(organization => organization.Slug == "other");

            // The other organization's one category
            var otherCategory = new OrganizationCategory { OrganizationId = other.Id, Position = 0, Name = "C" };
            context.OrganizationCategories.Add(otherCategory);

            // The member's address on the other organization's list too
            SelectionSeed.NewMember(context, other.Id, "member@example.com", _addedAt);

            // Lead of each
            context.CategoryLeads.AddRange(
                new CategoryLead
                {
                    OrganizationId = elementary.OrganizationId,
                    Email = "member@example.com",
                    CategoryId = elementary.Id,
                },
                new CategoryLead
                {
                    OrganizationId = other.Id,
                    Email = "member@example.com",
                    CategoryId = otherCategory.Id,
                });

            // Written
            await context.SaveChangesAsync();

            // The two categories
            return (elementary.Id, otherCategory.Id);
        });

        // MathComps' elementary category alone, for MathComps
        Assert.Equal([elementaryId], await members.GetLeadCategoryIdsAsync(_memberId, Organization.MathCompsSlug));

        // The other organization's own, for it
        Assert.Equal([otherCategoryId], await members.GetLeadCategoryIdsAsync(_memberId, "other"));

        // And none for the outsider, who leads nothing
        Assert.Empty(await members.GetLeadCategoryIdsAsync(_outsiderId, "other"));
    });

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

        // Another organization, whose name runs ahead of MathComps' where its slug runs after.
        var other = new Organization { Slug = "other", Name = "Alpha", NeedsEveryLanguage = false };
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

    /// <summary>
    /// Puts the member's address on the other organization's list as well.
    /// </summary>
    /// <returns>A task completing once the address is written.</returns>
    private Task ListMemberOnOtherAsync() => QueryAsync(async context =>
    {
        // The other organization
        var other = await context.Organizations.SingleAsync(organization => organization.Slug == "other");

        // The member's address on the other organization's list too
        SelectionSeed.NewMember(context, other.Id, "member@example.com", _addedAt);

        // Written
        await context.SaveChangesAsync();
    });
}

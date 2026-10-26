using MathComps.Domain.Contracts.Selection;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace MathComps.Infrastructure.Services.Organizations;

/// <summary>
/// Implements <see cref="IOrganizationMemberService"/> over the database, matching an account's address lowercased
/// against the organizations' lists, which hold every address lowercased.
/// </summary>
/// <param name="dbContextFactory">The factory minting each read's database context.</param>
public sealed class OrganizationMemberService(IDbContextFactory<MathCompsDbContext> dbContextFactory)
    : IOrganizationMemberService
{
    /// <inheritdoc/>
    public async Task<bool> IsMemberAsync(
        Guid userId, string organizationSlug, CancellationToken cancellationToken = default) =>
        // On the list, whenever the address was put there
        await GetMemberSinceAsync(userId, organizationSlug, cancellationToken) is not null;

    /// <inheritdoc/>
    public async Task<DateTimeOffset?> GetMemberSinceAsync(
        Guid userId, string organizationSlug, CancellationToken cancellationToken = default) =>
        // The one account's entry, where it has one
        (await GetMemberSinceAsync([userId], organizationSlug, cancellationToken))
        .TryGetValue(userId, out var since)
            ? since
            : null;

    /// <inheritdoc/>
    public async Task<IReadOnlyDictionary<Guid, DateTimeOffset>> GetMemberSinceAsync(
        IReadOnlyCollection<Guid> userIds, string organizationSlug, CancellationToken cancellationToken = default)
    {
        // A fresh context for this read.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // The organization's list, which the accounts are matched against.
        var members = dbContext.OrganizationMembers.Where(member => member.Organization.Slug == organizationSlug);

        // When each account's address was put on the list, for the accounts among them whose address is on it.
        return await dbContext.Users
            .AsNoTracking()
            .Where(user => userIds.Contains(user.Id) && user.Email != null)
            .Join(
                members,
                user => user.Email!.ToLower(),
                member => member.Email,
                (user, member) => new { user.Id, member.AddedAt })
            .ToDictionaryAsync(entry => entry.Id, entry => entry.AddedAt, cancellationToken);
    }

    /// <inheritdoc/>
    public async Task<IReadOnlyList<Guid>> GetOrganizationIdsAsync(
        Guid userId, CancellationToken cancellationToken = default)
    {
        // A fresh context for this read.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // The id of each organization whose list carries the account's address.
        return await OrganizationsOf(dbContext, userId)
            .Select(organization => organization.Id)
            .ToListAsync(cancellationToken);
    }

    /// <inheritdoc/>
    public async Task<IReadOnlyList<OrganizationDto>> GetOrganizationsAsync(
        Guid userId, CancellationToken cancellationToken = default)
    {
        // A fresh context for this read.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // Each organization whose list carries the account's address, as its slug and name, in the order of the names.
        return await OrganizationsOf(dbContext, userId)
            .OrderBy(organization => organization.Name)
            .Select(organization => new OrganizationDto(organization.Slug, organization.Name))
            .ToListAsync(cancellationToken);
    }

    /// <inheritdoc/>
    public async Task<IReadOnlySet<Guid>> GetLeadCategoryIdsAsync(
        Guid userId, string organizationSlug, CancellationToken cancellationToken = default)
    {
        // A fresh context for this read.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // The account's address, lowercased.
        var address = AddressOf(dbContext, userId);

        // The organization's categories the address leads.
        return await dbContext.CategoryLeads
            .AsNoTracking()
            .Where(lead => lead.Member.Organization.Slug == organizationSlug && address.Contains(lead.Email))
            .Select(lead => lead.CategoryId)
            .ToHashSetAsync(cancellationToken);
    }

    /// <summary>
    /// The organizations whose list carries an account's address.
    /// </summary>
    /// <param name="dbContext">The read's context.</param>
    /// <param name="userId">The account.</param>
    /// <returns>The organizations, still unrun.</returns>
    private static IQueryable<Organization> OrganizationsOf(MathCompsDbContext dbContext, Guid userId)
    {
        // The account's address, lowercased.
        var address = AddressOf(dbContext, userId);

        // The organizations listing that address.
        return dbContext.Organizations
            .AsNoTracking()
            .Where(organization => organization.Members.Any(member => address.Contains(member.Email)));
    }

    /// <summary>
    /// An account's address lowercased, the way the lists hold every address.
    /// </summary>
    /// <param name="dbContext">The read's context.</param>
    /// <param name="userId">The account.</param>
    /// <returns>The address, still unrun; none for an account without one.</returns>
    private static IQueryable<string> AddressOf(MathCompsDbContext dbContext, Guid userId) =>
        // The one account's address, where it has one
        dbContext.Users
            .Where(user => user.Id == userId && user.Email != null)
            .Select(user => user.Email!.ToLower());
}

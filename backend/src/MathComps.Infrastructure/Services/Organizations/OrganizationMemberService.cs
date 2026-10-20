using MathComps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace MathComps.Infrastructure.Services.Organizations;

/// <summary>
/// Implements <see cref="IOrganizationMemberService"/> over the database, matching an account's address lowercased
/// against the list, which holds every address lowercased.
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
}

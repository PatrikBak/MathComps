using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace MathComps.Infrastructure.Services.Users;

/// <summary>
/// Implements <see cref="IUserGrantService"/> over the database.
/// </summary>
/// <param name="dbContextFactory">The factory minting each read's database context.</param>
public sealed class UserGrantService(IDbContextFactory<MathCompsDbContext> dbContextFactory) : IUserGrantService
{
    /// <inheritdoc/>
    public async Task<bool> HasAsync(
        Guid userId, UserCapability capability, CancellationToken cancellationToken = default)
    {
        // A fresh context for this read.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // Whether a grant of this capability stands against the account.
        return await dbContext.UserGrants
            .AsNoTracking()
            .AnyAsync(
                grant => grant.UserId == userId && grant.Capability == capability,
                cancellationToken);
    }

    /// <inheritdoc/>
    public async Task<DateTimeOffset?> GetGrantedAtAsync(
        Guid userId, UserCapability capability, CancellationToken cancellationToken = default)
    {
        // A fresh context for this read.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // When the account's one grant of this capability was handed over, if it stands.
        return await dbContext.UserGrants
            .AsNoTracking()
            .Where(grant => grant.UserId == userId && grant.Capability == capability)
            .Select(grant => (DateTimeOffset?)grant.GrantedAt)
            .FirstOrDefaultAsync(cancellationToken);
    }

    /// <inheritdoc/>
    public async Task<IReadOnlyDictionary<Guid, DateTimeOffset>> GetGrantedAtAsync(
        IReadOnlyCollection<Guid> userIds, UserCapability capability, CancellationToken cancellationToken = default)
    {
        // A fresh context for this read.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // When each account among them was handed its one grant of this capability, for those it stands against.
        return await dbContext.UserGrants
            .AsNoTracking()
            .Where(grant => userIds.Contains(grant.UserId) && grant.Capability == capability)
            .Select(grant => new { grant.UserId, grant.GrantedAt })
            .ToDictionaryAsync(grant => grant.UserId, grant => grant.GrantedAt, cancellationToken);
    }
}

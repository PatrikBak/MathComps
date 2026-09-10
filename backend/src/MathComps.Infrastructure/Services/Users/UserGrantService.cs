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
}

using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
namespace MathComps.Infrastructure.Services;

/// <summary>
/// Service for managing users in the database.
/// </summary>
/// <param name="dbContext">The database context.</param>
/// <param name="logger">The logger.</param>
public class UserManager(MathCompsDbContext dbContext, ILogger<UserManager> logger) : IUserManager
{
    /// <inheritdoc />
    public async Task SyncUserAsync(UserSyncDto userDto, CancellationToken cancellationToken = default)
    {
        // Timestamp pressence
        var now = DateTime.UtcNow;

        // This cool little library compiles this onto a native upsert
        await dbContext.Users
            .Upsert(new User
            {
                ExternalId = userDto.ExternalId,
                FirstName = userDto.FirstName,
                LastName = userDto.LastName,
                Email = userDto.Email,
                CreatedAt = now,
                UpdatedAt = now
            })
            .On(user => user.ExternalId)
            .Exclude(user => user.CreatedAt)
            .RunAsync(cancellationToken);
    }

    /// <inheritdoc />
    public async Task DeleteUserAsync(string externalId, CancellationToken cancellationToken = default)
    {
        // Find the user by their Clerk ID.
        var user = await dbContext.Users.FirstOrDefaultAsync(user => user.ExternalId == externalId, cancellationToken);

        // Ensure there is a user to delete.
        if (user == null)
        {
            // Attempt to delete a deleted users are real sus
            logger.LogWarning("Deleting a non-existent user: {ExternalId}", externalId);
            return;
        }

        // Anonymize personal information.
        user.FirstName = null;
        user.LastName = null;
        user.Email = null;

        // Mark the user as soft-deleted
        user.IsDeleted = true;

        // Timestamp the update
        user.UpdatedAt = DateTimeOffset.UtcNow;

        // Save the changes to the database.
        // We do NOT remove the user entity, keeping foreign key relationships intact.
        await dbContext.SaveChangesAsync(cancellationToken);

        // Log the soft deletion of the user.
        logger.LogInformation("Soft-deleted user: {ExternalId}", externalId);
    }
}

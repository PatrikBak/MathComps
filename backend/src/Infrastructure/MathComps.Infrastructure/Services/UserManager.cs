using Clerk.BackendAPI;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Persistence;
using MathComps.Shared;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
namespace MathComps.Infrastructure.Services;

/// <summary>
/// Service for managing users in the database.
/// </summary>
/// <param name="dbContext">The database context.</param>
/// <param name="logger">The logger.</param>
public class UserManager(
    MathCompsDbContext dbContext,
    ClerkBackendApi clerkClient,
    ILogger<UserManager> logger
) : IUserManager
{
    /// <inheritdoc />
    public async Task<Guid> SyncUserAsync(UserSyncDto userDto, CancellationToken cancellationToken = default)
    {
        // Timestamp pressence
        var now = DateTime.UtcNow;

        // Create a user
        var user = new User
        {
            ExternalId = userDto.ExternalId,
            DisplayName = userDto.DisplayName,
            Email = userDto.Email,
            AvatarUrl = userDto.AvatarUrl,
            CreatedAt = now,
            UpdatedAt = now
        };

        // This cool little library compiles this onto a native upsert
        await dbContext.Users
            .Upsert(user)
            .On(user => user.ExternalId)
            .Exclude(user => new { user.CreatedAt, user.Id })
            .RunAsync(cancellationToken);

        // Return the user ID
        return await dbContext.Users
            .Where(user => user.ExternalId == userDto.ExternalId)
            .Select(user => user.Id)
            .FirstAsync(cancellationToken);
    }

    /// <inheritdoc />
    public async Task<Guid?> GetUserIdAsync(string externalId, CancellationToken cancellationToken = default)
    {
        // Query for user ID
        var userId = await dbContext.Users
            .Where(user => user.ExternalId == externalId)
            .Select(user => (Guid?)user.Id)
            .FirstOrDefaultAsync(cancellationToken);

        // If user exists, return the ID
        if (userId != null)
            return userId.Value;

        // If the user does not exist, then the webhook probably failed / wasn't quick enough
        logger.LogWarning("User {ExternalId} not found in DB, fetching from Clerk...", externalId);

        // Never mind, since I'm a perfection, we won't give up, let us call Clerk
        var clerkUser = await GeneralUtilities.TryExecuteAsync(
            async () => (await clerkClient.Users.GetAsync(externalId)).User,
            error => throw new Exception($"Error fetching user {externalId} from Clerk", error)
        );

        // Okay, unknown user user after all?
        if (clerkUser == null)
        {
            // Should be real weird...
            logger.LogWarning("User {ExternalId} not found in Clerk.", externalId);
            return null;
        }

        // The display name should be the first name
        var displayName = clerkUser.FirstName
            // And it should exist - either from social or email login
            ?? throw new ArgumentException("A user without a first name should not exist.");

        // Happy path, we have the user
        var userDto = new UserSyncDto(
            clerkUser.Id,
            clerkUser.EmailAddresses?.FirstOrDefault()?.EmailAddressValue ?? "",
            displayName,
            clerkUser.ImageUrl
        );

        // Sync user to DB
        return await SyncUserAsync(userDto, cancellationToken);
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
        user.DisplayName = "Deleted User";
        user.Email = null;
        user.AvatarUrl = null;

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

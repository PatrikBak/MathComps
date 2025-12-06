namespace MathComps.Infrastructure.Services;

/// <summary>
/// Defines the contract for managing users.
/// </summary>
public interface IUserManager
{
    /// <summary>
    /// Gets the internal user ID from an external provider ID. If the user does not exist, 
    /// it will attempt to create the user by fetching its data from Clerk.
    /// </summary>
    /// <param name="externalId">The external provider ID (e.g., Clerk ID).</param>
    /// <param name="cancellationToken">The cancellation token.</param>
    /// <returns>The internal user ID, or null if the user does not exist.</returns>
    Task<Guid?> GetUserIdAsync(string externalId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Synchronizes a user's data from an external provider.
    /// Creates the user if they don't exist, or updates them if they do.
    /// </summary>
    /// <param name="userDto">The user data to synchronize.</param>
    /// <param name="cancellationToken">The cancellation token.</param>
    /// <returns>The internal user ID.</returns>
    Task<Guid> SyncUserAsync(UserSyncDto userDto, CancellationToken cancellationToken = default);

    /// <summary>
    /// Deletes a user by their external provider ID.
    /// </summary>
    /// <param name="externalId">The external provider ID (e.g., Clerk ID).</param>
    /// <param name="cancellationToken">The cancellation token.</param>
    Task DeleteUserAsync(string externalId, CancellationToken cancellationToken = default);
}

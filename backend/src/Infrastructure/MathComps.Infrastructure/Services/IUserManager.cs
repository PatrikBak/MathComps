namespace MathComps.Infrastructure.Services;

/// <summary>
/// Defines the contract for managing users.
/// </summary>
public interface IUserManager
{
    /// <summary>
    /// Synchronizes a user's data from an external provider.
    /// Creates the user if they don't exist, or updates them if they do.
    /// </summary>
    /// <param name="userDto">The user data to synchronize.</param>
    /// <param name="cancellationToken">The cancellation token.</param>
    Task SyncUserAsync(UserSyncDto userDto, CancellationToken cancellationToken = default);

    /// <summary>
    /// Deletes a user by their external provider ID.
    /// </summary>
    /// <param name="externalId">The external provider ID (e.g., Clerk ID).</param>
    /// <param name="cancellationToken">The cancellation token.</param>
    Task DeleteUserAsync(string externalId, CancellationToken cancellationToken = default);
}

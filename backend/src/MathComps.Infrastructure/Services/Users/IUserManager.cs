using MathComps.Domain.Contracts.Users;
using MathComps.Infrastructure.Services.Clerk;

namespace MathComps.Infrastructure.Services.Users;

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

    /// <summary>
    /// Reads when the user acknowledged what talking to the AI tutor entails.
    /// </summary>
    /// <param name="userId">The internal user ID.</param>
    /// <param name="cancellationToken">The cancellation token.</param>
    /// <returns>The moment they acknowledged it, or null while they have yet to.</returns>
    Task<DateTimeOffset?> GetAiConsentAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Records that the user acknowledged what talking to the AI tutor entails. Acknowledging again leaves the
    /// original moment standing, so the record says when they were first told.
    /// </summary>
    /// <param name="userId">The internal user ID.</param>
    /// <param name="cancellationToken">The cancellation token.</param>
    Task RecordAiConsentAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Reads what the user has told us about themselves.
    /// </summary>
    /// <param name="userId">The internal user ID.</param>
    /// <param name="cancellationToken">The cancellation token.</param>
    /// <returns>Their profile, or null when no row answers to that id.</returns>
    Task<UserProfileDto?> GetProfileAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Takes a username for the user, which is what the site calls them from then on.
    /// </summary>
    /// <remarks>
    /// A username is chosen once and never changed, so this refuses a user who already has one.
    /// </remarks>
    /// <param name="userId">The internal user ID.</param>
    /// <param name="username">The name to take.</param>
    /// <param name="cancellationToken">The cancellation token.</param>
    Task SetUsernameAsync(Guid userId, string username, CancellationToken cancellationToken = default);

    /// <summary>
    /// Replaces what the user has told us about their competing.
    /// </summary>
    /// <remarks>
    /// Every field is written every time, so a null clears what stood before. None of it is permanent the way a
    /// username is.
    /// </remarks>
    /// <param name="userId">The internal user ID.</param>
    /// <param name="request">What they are saying about themselves now.</param>
    /// <param name="cancellationToken">The cancellation token.</param>
    Task UpdateProfileAsync(
        Guid userId, UpdateUserProfileRequest request, CancellationToken cancellationToken = default);
}

/// <summary>
/// Thrown when a username already answers for somebody else.
/// </summary>
public sealed class UsernameTakenException() : Exception("That username is already taken.");

/// <summary>
/// Thrown when the user already has a username, which cannot be exchanged for another.
/// </summary>
public sealed class UsernameAlreadySetException() : Exception("A username cannot be changed once set.");

/// <summary>
/// Thrown when a username breaks the rules a name has to keep.
/// </summary>
public sealed class UsernameRejectedException() : Exception("That username cannot be used.");

/// <summary>
/// Thrown when a profile field is outside what it is allowed to say.
/// </summary>
public sealed class ProfileValueInvalidException() : Exception("That profile value cannot be used.");

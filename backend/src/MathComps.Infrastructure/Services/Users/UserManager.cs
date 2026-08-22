using System.Text.RegularExpressions;
using Clerk.BackendAPI;
using MathComps.Domain.Contracts.Users;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Clerk;
using MathComps.Shared.Extensions;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Microsoft.Extensions.Logging;
namespace MathComps.Infrastructure.Services.Users;

/// <summary>
/// Service for managing users in the database.
/// </summary>
/// <param name="dbContextFactory">Mints a context per operation, since each method here is its own unit of work.</param>
/// <param name="clerkClient">The Clerk Backend API client used for upstream user lookups.</param>
/// <param name="logger">The logger.</param>
public partial class UserManager(
    IDbContextFactory<MathCompsDbContext> dbContextFactory,
    ClerkBackendApi clerkClient,
    ILogger<UserManager> logger
) : IUserManager
{
    /// <summary>
    /// The shortest a username may be.
    /// </summary>
    /// <remarks>
    /// This and the two rules below it are public so <c>UsernameRuleParityTests</c> can read them. The frontend
    /// keeps its own copy in <c>username-schema.ts</c>, to refuse a name while it can still be retyped, and that
    /// test is what stops the two drifting.
    /// </remarks>
    public const int MinUsernameLength = 3;

    /// <summary>
    /// The longest a username may be, short enough to sit in a results row.
    /// </summary>
    public const int MaxUsernameLength = 20;

    /// <summary>
    /// The characters a username may be built from: letters in any alphabet, digits, and the separators a name
    /// written out in full needs.
    /// </summary>
    [GeneratedRegex(@"^[\p{L}\p{N} _-]+$")]
    public static partial Regex UsernamePattern();

    /// <summary>
    /// A run of whitespace, which a name carries as a single space however it was typed.
    /// </summary>
    [GeneratedRegex(@"\s+")]
    private static partial Regex WhitespaceRunPattern();

    /// <inheritdoc />
    public async Task<Guid> SyncUserAsync(UserSyncDto userDto, CancellationToken cancellationToken = default)
    {
        // A fresh context for this operation.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // Timestamp pressence
        var now = DateTime.UtcNow;

        // Create a user
        var userEntity = new User
        {
            ExternalId = userDto.ExternalId,
            DisplayName = userDto.DisplayName,
            Email = userDto.Email,
            AvatarUrl = userDto.AvatarUrl,
            CreatedAt = now,
            UpdatedAt = now
        };

        // This cool little library compiles this onto a native upsert. The excluded columns are the ones the
        // upstream user carries nothing for, so writing them from this entity would blank whatever is there.
        await dbContext.Users
            .Upsert(userEntity)
            .On(user => user.ExternalId)
            .Exclude(user => new { user.CreatedAt, user.Id, user.ConsentedToAiAt, user.Username })
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
        // A fresh context for this operation.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

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
            clerkUser.EmailAddresses.FirstOrDefault()?.EmailAddressValue ?? "",
            displayName,
            clerkUser.ImageUrl
        );

        // Sync user to DB
        return await SyncUserAsync(userDto, cancellationToken);
    }

    /// <inheritdoc />
    public async Task DeleteUserAsync(string externalId, CancellationToken cancellationToken = default)
    {
        // A fresh context for this operation.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

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

    /// <inheritdoc />
    public async Task<DateTimeOffset?> GetAiConsentAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        // A fresh context for this operation.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // Narrow to the one user's stamp. An id with no row behind it answers the same null, since whoever is
        // behind it has never been told either.
        return await dbContext.Users
            .Where(user => user.Id == userId)
            .Select(user => user.ConsentedToAiAt)
            .FirstOrDefaultAsync(cancellationToken);
    }

    /// <inheritdoc />
    public async Task RecordAiConsentAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        // A fresh context for this operation.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // Stamp the moment, filtering on it still being unset so acknowledging a second time leaves the first
        // one standing rather than rewriting when they were told
        await dbContext.Users
            .Where(user => user.Id == userId && user.ConsentedToAiAt == null)
            .ExecuteUpdateAsync(
                setters => setters.SetProperty(user => user.ConsentedToAiAt, DateTimeOffset.UtcNow),
                cancellationToken);
    }

    /// <inheritdoc />
    public async Task<UserProfileDto?> GetProfileAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        // A fresh context for this operation.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // Narrow to the one user's own account details
        return await dbContext.Users
            .Where(user => user.Id == userId)
            .Select(user => new UserProfileDto(user.Username))
            .FirstOrDefaultAsync(cancellationToken);
    }

    /// <inheritdoc />
    public async Task SetUsernameAsync(Guid userId, string username, CancellationToken cancellationToken = default)
    {
        // The name as it will be stored, refused here when it breaks a rule
        var normalizedUsername = NormalizeUsername(username);

        // A fresh context for this operation.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // The row taking the name
        var user = await dbContext.Users
            .FirstOrDefaultAsync(user => user.Id == userId, cancellationToken)
            ?? throw new InvalidOperationException($"User {userId} was resolved and then vanished.");

        // A name is chosen once, so somebody who has one is not choosing again
        if (user.Username != null)
            throw new UsernameAlreadySetException();

        // Take it
        user.Username = normalizedUsername;
        user.UpdatedAt = DateTimeOffset.UtcNow;

        try
        {
            // Commit. Whether the name was free is asked here and nowhere earlier, since anything read first
            // could be taken by somebody else before this line runs.
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (IsUsernameCollision(exception))
        {
            // Somebody already answers to it
            throw new UsernameTakenException();
        }
    }

    /// <summary>
    /// Reads whether a failed write was the username index refusing a name somebody else already holds.
    /// </summary>
    /// <param name="exception">The failure the write came back with.</param>
    /// <returns>True when the username index rejected it, false otherwise.</returns>
    private static bool IsUsernameCollision(DbUpdateException exception) =>
        exception.InnerException is PostgresException
        {
            SqlState: PostgresErrorCodes.UniqueViolation,
            ConstraintName: MathCompsDbContext.UsernameIndexName
        };

    /// <summary>
    /// Trims a username, collapses the whitespace inside it, and holds it to the rules a name has to keep.
    /// </summary>
    /// <param name="username">The name as the caller sent it, which a hand-rolled request may not have set.</param>
    /// <returns>The name as it will be stored.</returns>
    private static string NormalizeUsername(string? username)
    {
        // Nothing written is nothing to take, which covers a body that carried no name at all
        var trimmedUsername = username.TrimToNull() ?? throw new UsernameRejectedException();

        // A run of space inside the name is one space, however it was typed
        var normalizedUsername = WhitespaceRunPattern().Replace(trimmedUsername, " ");

        // Long enough to be a name, short enough to sit in a results row
        if (normalizedUsername.Length is < MinUsernameLength or > MaxUsernameLength)
            throw new UsernameRejectedException();

        // Letters, digits, and the separators a written-out name needs
        if (!UsernamePattern().IsMatch(normalizedUsername))
            throw new UsernameRejectedException();

        // The name as it will be stored
        return normalizedUsername;
    }
}

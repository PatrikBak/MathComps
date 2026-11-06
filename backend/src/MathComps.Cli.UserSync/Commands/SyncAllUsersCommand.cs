using Clerk.BackendAPI;
using MathComps.Infrastructure.Services.Clerk;
using MathComps.Infrastructure.Services.Users;
using Microsoft.Extensions.Logging;
using Spectre.Console.Cli;

namespace MathComps.Cli.UserSync.Commands;

/// <summary>
/// Command to sync all users from Clerk to the database.
/// </summary>
/// <param name="clerkClient">The official Clerk client</param>
/// <param name="userManager">The user manager users are synced through</param>
/// <param name="logger">The logger the sync's progress goes through</param>
public class SyncAllUsersCommand(
    ClerkBackendApi clerkClient,
    IUserManager userManager,
    ILogger<SyncAllUsersCommand> logger
) : AsyncCommand
{
    /// <inheritdoc/>
    public override async Task<int> ExecuteAsync(CommandContext context)
    {
        // Log start
        logger.LogInformation("Fetching users from Clerk");

        // Fetch all users from Clerk
        var users = (await clerkClient.Users.ListAsync()).UserList?.ToList() ?? [];

        // Log number of users
        logger.LogInformation("Found {Count} users. Syncing", users.Count);

        // Sync each user into the database, logging progress after each
        foreach (var (index, user) in users.Index())
        {
            // Extract email from first email address
            var email = user.EmailAddresses.FirstOrDefault()?.EmailAddressValue;

            // The user's fields the database keeps
            var dto = new UserSyncDto(
                user.Id,
                email,
                user.ImageUrl
            );

            // Sync user to database
            await userManager.SyncUserAsync(dto);

            // Log the user and how far the sync has got
            logger.LogInformation("Synced {Done}/{Total}: {UserId}", index + 1, users.Count, user.Id);
        }

        // Log success
        logger.LogInformation("All users synced successfully");

        // Done
        return 0;
    }
}

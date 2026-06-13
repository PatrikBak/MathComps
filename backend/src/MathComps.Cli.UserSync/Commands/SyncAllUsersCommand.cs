using Clerk.BackendAPI;
using MathComps.Infrastructure.Services.Clerk;
using MathComps.Infrastructure.Services.Users;
using Spectre.Console;
using Spectre.Console.Cli;

namespace MathComps.Cli.UserSync.Commands;

/// <summary>
/// Command to sync all users from Clerk to the database.
/// </summary>
/// <param name="clerkClient">The official Clerk client for fetching users</param>
/// <param name="userManager">The user manager for upserting users</param>
public class SyncAllUsersCommand(
    ClerkBackendApi clerkClient,
    IUserManager userManager
) : AsyncCommand
{
    /// <inheritdoc/>
    public override async Task<int> ExecuteAsync(CommandContext context)
    {
        // Log start
        AnsiConsole.MarkupLine("[blue]Fetching users from Clerk...[/]");

        // Fetch all users from Clerk
        var users = (await clerkClient.Users.ListAsync()).UserList?.ToList() ?? [];

        // Log number of users
        AnsiConsole.MarkupLine($"[green]Found {users.Count} users. Syncing...[/]");

        // Progress bar for syncing
        await AnsiConsole.Progress()
            .AutoClear(false)
            .Columns(
                new TaskDescriptionColumn(),
                new ProgressBarColumn(),
                new PercentageColumn(),
                new SpinnerColumn()
            )
            .StartAsync(async ctx =>
            {
                // Add task
                var task = ctx.AddTask("[cyan]Syncing users[/]", maxValue: users.Count);

                // For each user
                foreach (var user in users)
                {
                    // Extract display name (which is the first name required)
                    var displayName = user.FirstName;

                    // In theory it should be there...
                    if (string.IsNullOrEmpty(displayName))
                    {
                        // Skip if no first name
                        AnsiConsole.MarkupLine($"[yellow]Skipping user {user.Id}: no first name[/]");
                        task.Increment(1);
                        continue;
                    }

                    // Extract email from first email address
                    var email = user.EmailAddresses?.FirstOrDefault()?.EmailAddressValue;

                    // Create sync DTO
                    var dto = new UserSyncDto(
                        user.Id,
                        email,
                        displayName,
                        user.ImageUrl
                    );

                    // Sync user to database
                    await userManager.SyncUserAsync(dto);

                    // Log success
                    AnsiConsole.MarkupLine($"[dim]Synced: {displayName} ({user.Id})[/]");
                    task.Increment(1);
                }
            });

        // Log success
        AnsiConsole.MarkupLine("[green]✓ All users synced successfully![/]");
        return 0;
    }
}

using MathComps.Cli.UserSync.Commands;
using MathComps.Infrastructure.Extensions;
using MathComps.Shared.Cli.Commands;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

// Bootstrap the tool and run its sole command.
return await CliApp.Create<Program>("User Sync")
    .ConfigureServices((services, configuration) =>
    {
        // Configure logging to reduce noise.
        services.AddLogging(logging => logging.SetMinimumLevel(LogLevel.Warning));

        // Make sure DI can resolve DbContext
        services.AddMathCompsDbContext(configuration);

        // Sync reads upstream users through the Clerk API client
        services.AddClerkApi();

        // It writes them into the database through the user manager
        services.AddUserServices();
    })
    .RunAsync<SyncAllUsersCommand>(args);

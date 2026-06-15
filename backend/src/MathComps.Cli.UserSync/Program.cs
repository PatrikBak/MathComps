using MathComps.Cli.UserSync.Commands;
using MathComps.Infrastructure.Extensions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Spectre.Console;
using Spectre.Console.Cli;
using Spectre.Console.Cli.Extensions.DependencyInjection;
using MathComps.Shared.Cli.Commands;

// Fancy header
AnsiConsole.Write(new FigletText("User Sync").Centered().Color(Color.Aqua));

// We'll use DI
var services = new ServiceCollection();

// Configuration is built manually to support user secrets and env variables.
var configuration = new ConfigurationBuilder()
    .AddUserSecrets<Program>()
    .AddEnvironmentVariables()
    .Build();

// Register configuration for dependency injection.
services.AddSingleton<IConfiguration>(configuration);

// Configure logging to reduce noise.
services.AddLogging(logging => logging.SetMinimumLevel(LogLevel.Warning));

// Make sure DI can resolve DbContext
services.AddMathCompsDbContext(configuration);

// Sync reads upstream users through the Clerk API client
services.AddClerkApi();

// It writes them into the database through the user manager
services.AddUserServices();

// Start the app with DI
using var registrar = new DependencyInjectionRegistrar(services);

// Run the app using our custom runner
return await CliRunner.RunAsync(new CommandApp<SyncAllUsersCommand>(registrar), args);

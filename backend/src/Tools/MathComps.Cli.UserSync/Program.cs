using MathComps.Cli.UserSync.Commands;
using MathComps.Infrastructure;
using MathComps.Infrastructure.Extensions;
using MathComps.Infrastructure.Options;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Spectre.Console;
using Spectre.Console.Cli;
using Spectre.Console.Cli.Extensions.DependencyInjection;

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

// Bind Clerk settings from configuration
services.AddOptions<ClerkSettings>()
    .Bind(configuration.GetSection(ClerkSettings.SectionName))
    .ValidateDataAnnotations();

// Make sure DI can resolve DbContext
services.AddMathCompsDbContext(configuration);

// Add infrastructure services which should inject ClerkBackendApi and IUserManager
services.AddInfrastructureServices();

// Start the app with DI
using var registrar = new DependencyInjectionRegistrar(services);

// Single command app
return await new CommandApp<SyncAllUsersCommand>(registrar).RunAsync(args);

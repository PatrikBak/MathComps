using MathComps.Cli.DatabaseSeeder;
using MathComps.Cli.DatabaseSeeder.Commands;
using MathComps.Infrastructure.Extensions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Spectre.Console.Cli;
using Spectre.Console.Cli.Extensions.DependencyInjection;

// Build a config...
var configuration = new ConfigurationBuilder()
    // Which starts off with user secrets
    .AddUserSecrets<Program>()
    // And might use env variables to override the connection string to update prod DB 😇
    .AddEnvironmentVariables()
    // Ship
    .Build();

// We'll use DI
var services = new ServiceCollection();

// Register configuration for dependency injection.
services.AddSingleton<IConfiguration>(configuration);

// Configure logging to reduce noise from EF Core queries.
services.AddLogging(logging =>
{
    // No logging of every crazy query
    logging.SetMinimumLevel(LogLevel.Warning);
});

// Make sure DI can resolve DbContext
services.AddMathCompsDbContext(configuration);

// The seeder contains the core logic for populating the database.
services.AddScoped<IDatabaseSeeder, DatabaseSeeder>();

// Start the app with DI
using var registrar = new DependencyInjectionRegistrar(services);

// Start the app with a single command
var app = new CommandApp<SeedCommand>(registrar);

// Run the app, it'll return the exit code
return await app.RunAsync(args);

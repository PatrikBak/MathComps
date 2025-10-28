using MathComps.Cli.Translation.Commands;
using MathComps.Cli.Translation.Services;
using MathComps.Cli.Translation.Settings;
using MathComps.Infrastructure;
using MathComps.Infrastructure.Extensions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Spectre.Console;
using Spectre.Console.Cli;
using Spectre.Console.Cli.Extensions.DependencyInjection;

// Fancy header
AnsiConsole.Write(new FigletText("Translations").Centered().Color(Color.Aqua));

// We'll use DI
var services = new ServiceCollection();

// Configuration is built manually to support both appsettings.json and user secrets.
var configuration = new ConfigurationBuilder()
    .AddJsonFile("appsettings.json", optional: false)
    .AddUserSecrets<Program>(optional: true)
    .AddEnvironmentVariables()
    .Build();

// Register configuration for dependency injection.
services.AddSingleton<IConfiguration>(configuration);

// HttpClient is registered for making HTTP requests to external APIs.
services.AddHttpClient();

// Add settings for commands
services.AddOptions<TranslateProblemsSettings>().Bind(configuration.GetSection("TranslateProblemsSettings"));

// Make sure DI can resolve DbContext
services.AddMathCompsDbContext(configuration);

// Add infrastructure services including the shared Gemini service
services.AddInfrastructureServices();

// Database operations are encapsulated in a dedicated service with scoped lifetime.
services.AddScoped<ITranslationDatabaseService, TranslationDatabaseService>();

// Start the app with DI
using var registrar = new DependencyInjectionRegistrar(services);
var app = new CommandApp(registrar);

// CLI command configuration defines the available commands and their routing.
app.Configure(config =>
{
    // Commands
    config.AddCommand<TranslateProblemsCommand>("translate-problems");

    // Helps debugging
    config.PropagateExceptions();
});

// The application runs with the provided command-line arguments and returns the exit code.
return await app.RunAsync(args);

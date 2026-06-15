using MathComps.Cli.Translation.Commands;
using MathComps.Cli.Translation.Services;
using MathComps.Cli.Translation.Settings;
using MathComps.Infrastructure.Extensions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Spectre.Console;
using Spectre.Console.Cli;
using Spectre.Console.Cli.Extensions.DependencyInjection;
using MathComps.Shared.Cli.Commands;

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
services.AddOptions<TranslateProblemsSettings>()
    .Bind(configuration.GetSection(TranslateProblemsSettings.SectionName))
    .ValidateDataAnnotations();

// Make sure DI can resolve DbContext
services.AddMathCompsDbContext(configuration);

// The translate command runs on Gemini
services.AddGemini();

// The parse command reads problem images through the problem services
services.AddProblemServices();

// Database operations are encapsulated in a dedicated service with scoped lifetime.
services.AddScoped<ITranslationDatabaseService, TranslationDatabaseService>();

// Start the app with DI
using var registrar = new DependencyInjectionRegistrar(services);

// Run the app using our custom runner
return await CliRunner.RunAsync(new CommandApp(registrar), args, config =>
{
    // Commands
    config.AddCommand<TranslateProblemsCommand>("translate");
    config.AddCommand<ParseTranslationsCommand>("parse");
});

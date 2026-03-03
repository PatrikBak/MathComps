using MathComps.Cli.Tagging.Commands;
using MathComps.Cli.Tagging.Services;
using MathComps.Cli.Tagging.Settings;
using MathComps.Infrastructure;
using MathComps.Infrastructure.Extensions;
using MathComps.Shared.Cli;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Spectre.Console;
using Spectre.Console.Cli;
using Spectre.Console.Cli.Extensions.DependencyInjection;
using System.Text;

// Configure console encoding to properly handle UTF-8 characters (e.g., Slovak diacritics)
// This is essential on Windows where the default console code page doesn't support UTF-8
Console.InputEncoding = Encoding.UTF8;
Console.OutputEncoding = Encoding.UTF8;

// Fancy header
AnsiConsole.Write(new FigletText("Tagging").Centered().Color(Color.Aqua));

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
services.AddOptions<SuggestTagsSettings>().Bind(configuration.GetSection("SuggestTagsSettings"));
services.AddOptions<TagProblemsSettings>().Bind(configuration.GetSection("TagProblemsSettings"));
services.AddOptions<VetoProblemTagsSettings>().Bind(configuration.GetSection("VetoProblemTagsSettings"));

// Make sure DI can resolve DbContext
services.AddMathCompsDbContext(configuration);

// Add infrastructure services including the shared problem lookup service
services.AddInfrastructureServices();

// Database operations are encapsulated in a dedicated service with scoped lifetime.
services.AddScoped<ITaggingDatabaseService, TaggingDatabaseService>();

// Start the app with DI
using var registrar = new DependencyInjectionRegistrar(services);

// Run the app using our custom runner
return await CliRunner.RunAsync(new CommandApp(registrar), args, config =>
{
    // Commands
    config.AddCommand<SuggestTagsCommand>("suggest-tags");
    config.AddCommand<TagProblemsCommand>("tag-problems");
    config.AddCommand<VetoProblemTagsCommand>("veto-problem-tags");
    config.AddCommand<PruneTagsCommand>("prune-tags");
    config.AddCommand<InteractiveTagManagerCommand>("interactive");
    config.AddCommand<ImportTagsCommand>("import-tags");
});

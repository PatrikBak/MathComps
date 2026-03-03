using MathComps.Cli.SkmoScraper.Commands;
using MathComps.Cli.SkmoScraper.Services;
using MathComps.Infrastructure.Extensions;
using MathComps.Shared.Cli;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Spectre.Console;
using Spectre.Console.Cli;
using Spectre.Console.Cli.Extensions.DependencyInjection;
using System.Text;

// Fancy header
AnsiConsole.Write(new FigletText("SKMO Scraper").Centered().Color(Color.Aqua));

// We need this to handle window-1250...Crazy
Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);

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

// The core scraping logic is encapsulated in a dedicated service.
services.AddHttpClient<ISkmoScraperService, SkmoScraperService>();

// This does actual DB manipulation
services.AddTransient<ISkmoDatabaseService, SkmoDatabaseService>();

// Register database context using Infrastructure project's extension method
services.AddMathCompsDbContext(configuration);

// A custom registrar is used to integrate Spectre.Console.Cli with the DI container.
using var registrar = new DependencyInjectionRegistrar(services);

// Run the app using our custom runner
return await CliRunner.RunAsync(new CommandApp(registrar), args, config =>
{
    // Register commands
    config.AddCommand<ScrapeSkmoCommand>("scrape");
    config.AddCommand<UpdateSolutionLinksCommand>("update-solution-links");
});

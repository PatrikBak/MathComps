using MathComps.Cli.SkmoScraper.Commands;
using MathComps.Cli.SkmoScraper.Services;
using MathComps.Infrastructure.Extensions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Spectre.Console.Cli;
using Spectre.Console.Cli.Extensions.DependencyInjection;
using System.Text;
using System.Text.Json;

// We need this to handle window-1250...Crazy
Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);

// Build the host with logging configuration to suppress default logging output
var builder = Host.CreateApplicationBuilder(args);

// Configure logging to minimize console output and focus on errors only
builder.Logging.ClearProviders();
builder.Logging.SetMinimumLevel(LogLevel.Warning);

// Add user secrets for development (connection string will come from secrets)
builder.Configuration.AddUserSecrets<Program>(optional: true);

// The core scraping logic is encapsulated in a dedicated service.
builder.Services.AddHttpClient<ISkmoScraperService, SkmoScraperService>();

// This does actual DB manipulation
builder.Services.AddTransient<ISkmoDatabaseService, SkmoDatabaseService>();

// Register database context using Infrastructure project's extension method
builder.Services.AddMathCompsDbContext(builder.Configuration);

// The JSON serializer is configured to write indented JSON for readability.
builder.Services.AddSingleton(new JsonSerializerOptions
{
    WriteIndented = true,
});

// A custom registrar is used to integrate Spectre.Console.Cli with the application's service collection.
using var registrar = new DependencyInjectionRegistrar(builder.Services);
var app = new CommandApp(registrar);

// The application is configured with commands for scraping and updating solution links.
app.Configure(config =>
{
    // Register commands
    config.AddCommand<ScrapeSkmoCommand>("scrape");
    config.AddCommand<UpdateSolutionLinksCommand>("update-solution-links");

    // Helps debugging
    config.PropagateExceptions();
});

// The application runs with the provided command-line arguments and returns the exit code.
return await app.RunAsync(args);

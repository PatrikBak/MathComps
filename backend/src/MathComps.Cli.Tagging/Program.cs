using MathComps.Cli.Tagging.Commands;
using MathComps.Cli.Tagging.Services;
using MathComps.Cli.Tagging.Settings;
using MathComps.Infrastructure.Extensions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Spectre.Console;
using Spectre.Console.Cli;
using Spectre.Console.Cli.Extensions.DependencyInjection;
using System.Text;
using MathComps.Shared.Cli.Commands;

// Configure console encoding to properly handle UTF-8 characters (e.g., Slovak diacritics)
// This is essential on Windows where the default console code page doesn't support UTF-8
Console.InputEncoding = Encoding.UTF8;
Console.OutputEncoding = Encoding.UTF8;

// Render the "Tagging" banner.
AnsiConsole.Write(new FigletText("Tagging").Centered().Color(Color.Aqua));

// Build the service collection.
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

// tag-draft binds its four Gemini passes and the fit floor.
services.AddOptions<TagDraftSettings>()
    .Bind(configuration.GetSection(TagDraftSettings.SectionName))
    .ValidateDataAnnotations();

// Tagging runs on Gemini.
services.AddGemini();

// Register the draft-tagging core that wraps Gemini with the generate/veto passes.
services.AddScoped<IAiTaggingService, AiTaggingService>();

// Wrap the services in the registrar the CommandApp resolves from.
using var registrar = new DependencyInjectionRegistrar(services);

// Run the CLI.
return await CliRunner.RunAsync(new CommandApp(registrar), args, config =>
{
    // The sole command — tag a bulk-import draft in place.
    config.AddCommand<TagDraftCommand>("tag-draft");
});

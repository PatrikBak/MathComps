using MathComps.Cli.BulkImport.Commands;
using MathComps.Infrastructure;
using MathComps.Infrastructure.Extensions;
using MathComps.Shared.Cli;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Spectre.Console;
using Spectre.Console.Cli;
using Spectre.Console.Cli.Extensions.DependencyInjection;

// Fancy header — suppressed under --json so stdout stays pure JSON.
if (!args.Contains("--json"))
    AnsiConsole.Write(new FigletText("Bulk Import").Centered().Color(Color.Aqua));

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

// Make sure DI can resolve DbContext — validate connects read-only for the create-vs-reuse preview.
services.AddMathCompsDbContext(configuration);

// Add infrastructure services — the metadata localization service the registry-link check uses, and the
// read-only DB-resolution service backing the preview.
services.AddInfrastructureServices();

// Start the app with DI
using var registrar = new DependencyInjectionRegistrar(services);

// Run the app using our custom runner
return await CliRunner.RunAsync(new CommandApp(registrar), args, config =>
{
    // The dry-run command; the import command slots in later as a sibling.
    config.AddCommand<ValidateCommand>("validate");
});

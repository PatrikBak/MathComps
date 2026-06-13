using MathComps.Cli.Handouts;
using MathComps.Infrastructure.Extensions;
using MathComps.Shared.Cli;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Spectre.Console;
using Spectre.Console.Cli;
using Spectre.Console.Cli.Extensions.DependencyInjection;

// Fancy header
AnsiConsole.Write(new FigletText("Handouts").Centered().Color(Color.Aqua));

// We'll use DI
var services = new ServiceCollection();

// Configuration is built manually to support appsettings.json, user secrets, and env vars.
var configuration = new ConfigurationBuilder()
    .AddJsonFile("appsettings.json", optional: false)
    .AddUserSecrets<Program>(optional: true)
    .AddEnvironmentVariables()
    .Build();

// Register configuration for dependency injection.
services.AddSingleton<IConfiguration>(configuration);

// The R2 uploader handout asset uploads build on, wrapped in the tracker that skips unchanged assets across runs;
// the ledger lives alongside the handout sources.
var handoutsLedgerPath = Path.Combine("../../../../data/handouts", ".r2-uploads.json");
services.AddStorage().AddTrackedFileUploader(handoutsLedgerPath);

// Register the lazy service provider so that Lazy<T> can be injected
services.AddTransient(typeof(Lazy<>), typeof(LazyService<>));

// Start the app with DI
using var registrar = new DependencyInjectionRegistrar(services);

// Run the app using our custom runner
return await CliRunner.RunAsync(new CommandApp<BuildCommand>(registrar), args);

using MathComps.Cli.Handouts;
using MathComps.Infrastructure.Storage;
using MathComps.Shared.Cli;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
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

// Register R2 settings with validation via the options pipeline
services.AddOptions<R2Settings>()
    .Bind(configuration.GetSection(R2Settings.SectionName))
    .ValidateDataAnnotations();

// Register the R2 uploader as the file uploader implementation
services.AddSingleton<IFileUploader, R2Uploader>();

// Decorate the uploader with the deduping tracker so unchanged assets aren't re-uploaded across runs; the ledger
// lives alongside the handout sources. Expose that one instance as ITrackedFileUploader for the build command's
// per-asset upload/skip signal.
var handoutsLedgerPath = Path.Combine("../../../../data/handouts", ".r2-uploads.json");
services.AddSingleton(Options.Create(new UploadLedgerOptions { LedgerPath = handoutsLedgerPath }));
services.Decorate<IFileUploader, TrackedFileUploader>();
services.AddSingleton(provider => (ITrackedFileUploader)provider.GetRequiredService<IFileUploader>());

// Register the lazy service provider so that Lazy<T> can be injected
services.AddTransient(typeof(Lazy<>), typeof(LazyService<>));

// Start the app with DI
using var registrar = new DependencyInjectionRegistrar(services);

// Run the app using our custom runner
return await CliRunner.RunAsync(new CommandApp<BuildCommand>(registrar), args);

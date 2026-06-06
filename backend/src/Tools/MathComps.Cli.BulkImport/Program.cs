using MathComps.Cli.BulkImport.Commands;
using MathComps.Cli.BulkImport.Validation;
using MathComps.Infrastructure;
using MathComps.Infrastructure.BulkImport;
using MathComps.Infrastructure.Extensions;
using MathComps.Infrastructure.Storage;
using MathComps.Shared.Cli;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
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

// Add infrastructure services — the metadata localization service the registry-link check uses, the read-only
// DB-resolution service backing the preview, and the R2 uploader the import builds on.
services.AddInfrastructureServices();

// Dedupe image uploads against a ledger kept beside this tool's sources — gitignored and preserved across runs,
// so a re-apply skips images already on R2 no matter which draft folder they came from. Resolve the path from the
// assembly location (bin/<config>/<tfm> ⇒ up three to the project dir) so it's found regardless of the working
// directory. Decorate wraps the R2 uploader in the tracker; expose that one instance as ITrackedFileUploader.
var projectDirectory = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", ".."));
var uploadLedgerPath = Path.Combine(projectDirectory, ".r2-uploads.json");
services.AddSingleton(Options.Create(new UploadLedgerOptions { LedgerPath = uploadLedgerPath }));
services.Decorate<IFileUploader, TrackedFileUploader>();
services.AddSingleton(provider => (ITrackedFileUploader)provider.GetRequiredService<IFileUploader>());

// The apply service lives here rather than in shared infrastructure because it depends on the tracking uploader
// above, which only this tool wires up.
services.AddScoped<IDraftApplyService, DraftApplyService>();

// The validation pipeline both commands share.
services.AddScoped<DraftValidationPipeline>();

// Wrap the service collection for Spectre's DI.
using var registrar = new DependencyInjectionRegistrar(services);

// Run the app using our custom runner
return await CliRunner.RunAsync(new CommandApp(registrar), args, config =>
{
    // The dry-run command and its mutating sibling, the import.
    config.AddCommand<ValidateCommand>("validate");
    config.AddCommand<ApplyCommand>("apply");
});

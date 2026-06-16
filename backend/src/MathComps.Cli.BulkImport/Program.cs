using MathComps.Cli.BulkImport.Commands;
using MathComps.Cli.BulkImport.Validation;
using MathComps.Infrastructure.BulkImport;
using MathComps.Infrastructure.Extensions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Spectre.Console;
using Spectre.Console.Cli;
using Spectre.Console.Cli.Extensions.DependencyInjection;
using MathComps.Shared.Cli.Commands;

// Fancy header.
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

// The metadata localization service the registry-link check uses
services.AddLocalization();

// The read-only DB-resolution service backing the preview
services.AddBulkImport();

// Resolve the ledger path from the assembly location (bin/<config>/<tfm> ⇒ up three to the project dir) so the
// dedupe ledger is found beside this tool's sources regardless of the working directory.
var projectDirectory = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", ".."));
var uploadLedgerPath = Path.Combine(projectDirectory, ".r2-uploads.json");
// The R2 uploader the import builds on, wrapped in the tracker that skips images already on R2 across re-applies.
services.AddStorage().AddTrackedFileUploader(uploadLedgerPath);

// The apply service that writes a resolved draft to the database.
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

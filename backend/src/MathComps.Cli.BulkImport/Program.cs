using MathComps.Cli.BulkImport.Commands;
using MathComps.Cli.BulkImport.Validation;
using MathComps.Infrastructure.BulkImport;
using MathComps.Infrastructure.Extensions;
using MathComps.Shared.Cli.Commands;
using Microsoft.Extensions.DependencyInjection;

// Bootstrap the tool and run the requested command.
return await CliApp.Create<Program>("Bulk Import")
    .ConfigureServices((services, configuration) =>
    {
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
    })
    .RunAsync(args, config =>
    {
        // The dry-run command and its mutating sibling, the import.
        config.AddCommand<ValidateCommand>("validate");
        config.AddCommand<ApplyCommand>("apply");
    });

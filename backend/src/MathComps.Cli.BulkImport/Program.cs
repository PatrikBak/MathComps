using MathComps.Cli.BulkImport.Commands;
using MathComps.Cli.BulkImport.Validation;
using MathComps.Infrastructure.BulkImport;
using MathComps.Infrastructure.Extensions;
using MathComps.Shared.Cli;
using MathComps.Shared.Cli.Commands;
using Microsoft.Extensions.DependencyInjection;

// Bootstrap the tool and run the requested command.
return await CliApp.Create<Program>("Bulk Import")
    .RequireConfigFile("appsettings.json")
    .ConfigureServices((services, configuration) =>
    {
        // Make sure DI can resolve DbContext — validate connects read-only for the create-vs-reuse preview.
        services.AddMathCompsDbContext(configuration);

        // The metadata localization service the registry-link check uses
        services.AddLocalization();

        // The read-only DB-resolution service backing the preview
        services.AddBulkImport();

        // The R2 uploader, wrapped in the tracker that skips images already on R2 across re-applies;
        // the ledger lives beside the draft sources.
        var uploadLedgerPath = RepoPaths.Resolve("data/problems", ".r2-uploads.json");
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

using MathComps.Cli.BulkImport.Commands;
using MathComps.Infrastructure.Extensions;
using MathComps.Shared.Cli;
using MathComps.Shared.Cli.Commands;
using MathComps.Shared.DependencyInjection;
using Microsoft.Extensions.DependencyInjection;

// Bootstrap the tool and run its sole command — import draft folders, or dry-run them.
return await CliApp.Create<Program>()
    .RequireConfigFile("appsettings.json")
    .ConfigureServices((services, configuration) =>
    {
        // The import reads and writes the archive's own tables.
        services.AddMathCompsDbContext(configuration);

        // The registry the registry-link check and the taxonomy writes read.
        services.AddLocalization();

        // The R2 uploader, wrapped in the tracker that skips images already on R2 across re-imports;
        // the ledger lives beside the draft sources.
        var uploadLedgerPath = RepoPaths.Resolve("data/problems", ".r2-uploads.json");
        services.AddStorage().AddTrackedFileUploader(uploadLedgerPath);

        // Lazy<T> injection, so a dry run never builds the uploader.
        services.AddTransient(typeof(Lazy<>), typeof(LazyService<>));

        // The import itself.
        services.AddBulkImport();
    })
    .RunAsync<ImportCommand>(args);

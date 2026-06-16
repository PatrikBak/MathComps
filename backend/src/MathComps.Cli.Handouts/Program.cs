using MathComps.Cli.Handouts.Commands;
using MathComps.Infrastructure.Extensions;
using MathComps.Shared.Cli;
using MathComps.Shared.Cli.Commands;
using MathComps.Shared.DependencyInjection;
using Microsoft.Extensions.DependencyInjection;

// Bootstrap the tool and run its sole command.
return await CliApp.Create<Program>("Handouts")
    .ConfigureServices((services, _) =>
    {
        // The R2 uploader handout asset uploads build on, wrapped in the tracker that skips unchanged assets across
        // runs; the ledger lives alongside the handout sources.
        var handoutsLedgerPath = RepoPaths.Resolve("data/handouts", ".r2-uploads.json");
        services.AddStorage().AddTrackedFileUploader(handoutsLedgerPath);

        // Register the lazy service provider so that Lazy<T> can be injected
        services.AddTransient(typeof(Lazy<>), typeof(LazyService<>));
    })
    .RunAsync<BuildCommand>(args);

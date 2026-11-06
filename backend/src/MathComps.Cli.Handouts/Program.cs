using MathComps.Cli.Handouts.Commands;
using MathComps.Infrastructure.Extensions;
using MathComps.Shared.Cli;
using MathComps.Shared.Cli.Commands;
using MathComps.Shared.DependencyInjection;
using Microsoft.Extensions.DependencyInjection;

// Bootstrap the tool and run its sole command.
return await CliApp.Create<Program>()
    .RequireConfigFile("appsettings.json")
    .ConfigureServices((services, _) =>
    {
        // The R2 uploader, wrapped in the tracker that skips unchanged assets across runs;
        // the ledgers, one per bucket, live alongside the handout sources.
        var handoutsLedgerDirectory = RepoPaths.Resolve("data/handouts", ".r2-uploads");
        services.AddStorage().AddTrackedFileUploader(handoutsLedgerDirectory);

        // Register the lazy service provider so that Lazy<T> can be injected
        services.AddTransient(typeof(Lazy<>), typeof(LazyService<>));
    })
    .RunAsync<BuildCommand>(args);

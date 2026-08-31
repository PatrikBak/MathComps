using MathComps.Cli.Competitions.Commands;
using MathComps.Infrastructure.Extensions;
using MathComps.Infrastructure.Services.Competitions;
using MathComps.Shared.Cli.Commands;
using Microsoft.Extensions.DependencyInjection;

// Bootstrap the tool and run its sole command — declare a hosted group from its manifest.
return await CliApp.Create<Program>("Competitions")
    .RequireConfigFile("appsettings.json")
    .ConfigureServices((services, configuration) =>
    {
        // The manifest is written against the archive's own tables.
        services.AddMathCompsDbContext(configuration);

        // What raises a node and a season the manifest names and the database has not met yet.
        services.AddCompetitionTreeWriter();

        // The service the command hands the manifest to.
        services.AddScoped<IHostedGroupService, HostedGroupService>();
    })
    .RunAsync<DeclareGroupCommand>(args);

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
        // The manifest is applied against rounds that are already in the database.
        services.AddMathCompsDbContext(configuration);

        // The service the command hands the manifest to.
        services.AddScoped<IHostedGroupService, HostedGroupService>();
    })
    .RunAsync<DeclareGroupCommand>(args);

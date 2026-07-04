using MathComps.Cli.Tagging.Commands;
using MathComps.Cli.Tagging.Services;
using MathComps.Cli.Tagging.Settings;
using MathComps.Infrastructure.Extensions;
using MathComps.Shared.Cli.Commands;
using Microsoft.Extensions.DependencyInjection;

// Bootstrap the tool and run its sole command — tag a bulk-import draft in place.
return await CliApp.Create<Program>("Tagging")
    .ConfigureServices((services, configuration) =>
    {
        // The tagging command binds its four prompt passes and the fit floor.
        services.AddOptions<TagDraftSettings>()
            .Bind(configuration.GetSection(TagDraftSettings.SectionName))
            .ValidateDataAnnotations();

        // The OpenRouter chat stack: settings, chat client, retrying caller, and spend reader.
        services.AddOpenRouterChat(configuration);

        // Register the draft-tagging core that wraps the model with the generate/veto passes.
        services.AddScoped<IAiTaggingService, AiTaggingService>();
    })
    .RunAsync<TagDraftCommand>(args);

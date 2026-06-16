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
        // HttpClient is registered for making HTTP requests to external APIs.
        services.AddHttpClient();

        // The tagging command binds its four Gemini passes and the fit floor.
        services.AddOptions<TagDraftSettings>()
            .Bind(configuration.GetSection(TagDraftSettings.SectionName))
            .ValidateDataAnnotations();

        // Tagging runs on Gemini.
        services.AddGemini();

        // Register the draft-tagging core that wraps Gemini with the generate/veto passes.
        services.AddScoped<IAiTaggingService, AiTaggingService>();
    })
    .RunAsync<TagDraftCommand>(args);

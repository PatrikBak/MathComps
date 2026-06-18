using System.ClientModel;
using MathComps.Cli.Tagging.Commands;
using MathComps.Cli.Tagging.Services;
using MathComps.Cli.Tagging.Settings;
using MathComps.Shared.Cli.Commands;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using OpenAI;
using OpenAI.Chat;

// Bootstrap the tool and run its sole command — tag a bulk-import draft in place.
return await CliApp.Create<Program>("Tagging")
    .ConfigureServices((services, configuration) =>
    {
        // The tagging command binds its four prompt passes and the fit floor.
        services.AddOptions<TagDraftSettings>()
            .Bind(configuration.GetSection(TagDraftSettings.SectionName))
            .ValidateDataAnnotations();

        // The OpenRouter connection: base URL + model from appsettings, API key from user secrets.
        services.AddOptions<OpenRouterSettings>()
            .Bind(configuration.GetSection(OpenRouterSettings.SectionName))
            .Validate(settings => !string.IsNullOrWhiteSpace(settings.ApiKey),
                $"{OpenRouterSettings.SectionName}:{nameof(OpenRouterSettings.ApiKey)} is not configured. Set it in user secrets.")
            .ValidateDataAnnotations();

        // One chat client for the whole run, pointed at OpenRouter's OpenAI-compatible endpoint and bound to the
        // configured model. OpenRouter auto-routes that model to the cheapest available provider.
        services.AddSingleton(serviceProvider =>
        {
            // Pull the connection settings.
            var settings = serviceProvider.GetRequiredService<IOptions<OpenRouterSettings>>().Value;

            // Build the OpenAI client against OpenRouter's endpoint, bound to the configured model.
            var chatClient = new ChatClient(
                settings.Model,
                new ApiKeyCredential(settings.ApiKey),
                new OpenAIClientOptions { Endpoint = new Uri(settings.BaseUrl) });

            // Expose it through the Microsoft.Extensions.AI abstraction the tagging core depends on.
            return chatClient.AsIChatClient();
        });

        // Register the draft-tagging core that wraps the model with the generate/veto passes.
        services.AddScoped<IAiTaggingService, AiTaggingService>();

        // Reads the key's all-time spend so a run can report what it cost.
        services.AddHttpClient<IOpenRouterUsageReader, OpenRouterUsageReader>();
    })
    .RunAsync<TagDraftCommand>(args);

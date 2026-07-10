using MathComps.Cli.Embeddings.Commands;
using MathComps.Cli.Embeddings.Services;
using MathComps.Infrastructure.Extensions;
using MathComps.Infrastructure.Options;
using MathComps.Shared.Cli.Commands;
using Microsoft.Extensions.DependencyInjection;

// Bootstrap the tool and run its sole command.
return await CliApp.Create<Program>("Embeddings")
    .RequireConfigFile("appsettings.json")
    .ConfigureServices((services, configuration) =>
    {
        // HttpClient is registered for making HTTP requests to external APIs.
        services.AddHttpClient();

        // Gemini API settings are bound from configuration
        services.AddOptions<GeminiSettings>()
            .Bind(configuration.GetSection(GeminiSettings.SectionName))
            .ValidateDataAnnotations();

        // Bind the Gemini embedding service
        services.AddHttpClient<IGeminiEmbeddingService, GeminiEmbeddingService>();

        // Make sure DI can resolve DbContext
        services.AddMathCompsDbContext(configuration);

        // Database operations are encapsulated in a dedicated service with scoped lifetime.
        services.AddScoped<IEmbeddingDatabaseService, EmbeddingDatabaseService>();
    })
    .RunAsync<GenerateEmbeddingsCommand>(args);

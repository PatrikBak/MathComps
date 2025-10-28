using MathComps.Cli.Embeddings.Commands;
using MathComps.Cli.Embeddings.Services;
using MathComps.Cli.Embeddings.Settings;
using MathComps.Infrastructure;
using MathComps.Infrastructure.Extensions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Spectre.Console.Cli;
using Spectre.Console.Cli.Extensions.DependencyInjection;

// We'll use DI
var services = new ServiceCollection();

// Configuration is built manually to support both appsettings.json and user secrets.
var configuration = new ConfigurationBuilder()
    .AddJsonFile("appsettings.json", optional: false)
    .AddUserSecrets<Program>(optional: true)
    .AddEnvironmentVariables()
    .Build();

// Register configuration for dependency injection.
services.AddSingleton<IConfiguration>(configuration);

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

// Add infrastructure services
services.AddInfrastructureServices();

// Database operations are encapsulated in a dedicated service with scoped lifetime.
services.AddScoped<IEmbeddingDatabaseService, EmbeddingDatabaseService>();

// Start the app with DI
using var registrar = new DependencyInjectionRegistrar(services);
var app = new CommandApp(registrar);

// CLI command configuration defines the available commands and their routing.
app.Configure(config =>
{
    // Commands
    config.AddCommand<GenerateEmbeddingsCommand>("generate-embeddings");

    // Helps debugging
    config.PropagateExceptions();
});

// The application runs with the provided command-line arguments and returns the exit code.
return await app.RunAsync(args);

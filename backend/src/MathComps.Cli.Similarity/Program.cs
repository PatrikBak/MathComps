using MathComps.Cli.Similarity.Commands;
using MathComps.Cli.Similarity.Services;
using MathComps.Cli.Similarity.Settings;
using MathComps.Infrastructure.Extensions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Spectre.Console;
using Spectre.Console.Cli;
using Spectre.Console.Cli.Extensions.DependencyInjection;
using MathComps.Shared.Cli.Commands;

// Fancy header
AnsiConsole.Write(new FigletText("Similarities").Centered().Color(Color.Aqua));

// We'll use DI
var services = new ServiceCollection();

// Configuration is built manually to support both appsettings.json and user secrets.
var configuration = new ConfigurationBuilder()
    .SetBasePath(AppContext.BaseDirectory)
    .AddJsonFile("appsettings.json", optional: false)
    .AddUserSecrets<Program>(optional: true)
    .AddEnvironmentVariables()
    .Build();

// Register configuration for dependency injection.
services.AddSingleton<IConfiguration>(configuration);

// Make sure DI can resolve DbContext
services.AddMathCompsDbContext(configuration);

// The interactive manager reads through the problem lookup service
services.AddProblemServices();

// Bind similarity calculation settings
services.AddOptions<SimilarityCalculationSettings>()
    .Bind(configuration.GetSection(SimilarityCalculationSettings.SectionName))
    .ValidateDataAnnotations();

// Database operations are encapsulated in a dedicated service with scoped lifetime.
services.AddScoped<ISimilarityDatabaseService, SimilarityDatabaseService>();

// Problem data service for loading problems from database in batches.
services.AddScoped<IProblemDataService, ProblemDataService>();

// Unified problem similarity service for comprehensive similarity calculation.
services.AddScoped<IProblemSimilarityService, ProblemSimilarityService>();

// Start the app with DI
using var registrar = new DependencyInjectionRegistrar(services);

// Run the app using our custom runner
return await CliRunner.RunAsync(new CommandApp<CalculateSimilaritiesCommand>(registrar), args, config =>
{
    // Commands
    config.AddCommand<CalculateSimilaritiesCommand>("calculate-similarities");
    config.AddCommand<InteractiveSimilarityManagerCommand>("interactive");
});

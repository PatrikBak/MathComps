using MathComps.Cli.Similarity.Commands;
using MathComps.Cli.Similarity.Services;
using MathComps.Cli.Similarity.Settings;
using MathComps.Infrastructure.Extensions;
using MathComps.Shared.Cli.Commands;
using Microsoft.Extensions.DependencyInjection;

// Bootstrap the tool and run the requested command.
return await CliApp.Create<Program>("Similarities")
    .RequireConfigFile("appsettings.json")
    .ConfigureServices((services, configuration) =>
    {
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
    })
    .RunAsync<CalculateSimilaritiesCommand>(args, config =>
    {
        // The default batch calculation and its interactive REPL sibling.
        config.AddCommand<CalculateSimilaritiesCommand>("calculate-similarities");
        config.AddCommand<InteractiveSimilarityManagerCommand>("interactive");
    });

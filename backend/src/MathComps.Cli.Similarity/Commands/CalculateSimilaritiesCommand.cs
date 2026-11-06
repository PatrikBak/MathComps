using MathComps.Cli.Similarity.Services;
using Microsoft.Extensions.Logging;
using Spectre.Console.Cli;
using System.ComponentModel;
using MathComps.Shared.Cli.Progress;

namespace MathComps.Cli.Similarity.Commands;

/// <summary>
/// A command that calculates and stores the similar problems of each problem it picks, one problem at a time:
/// <list type="number">
/// <item>Load the problem's similarity data</item>
/// <item>Score its similarities</item>
/// <item>Store the results</item>
/// </list>
/// </summary>
/// <param name="problemDataService">The service that picks the problems and loads their similarity data.</param>
/// <param name="problemSimilarityService">The service that scores a problem's similarities.</param>
/// <param name="databaseService">Service for storing similarity results.</param>
/// <param name="logger">The logger the run's progress and failures go through.</param>
[Description("Calculate similarity relationships between problems using embeddings, tags, and competition context.")]
public class CalculateSimilaritiesCommand(
    IProblemDataService problemDataService,
    IProblemSimilarityService problemSimilarityService,
    ISimilarityDatabaseService databaseService,
    ILogger<CalculateSimilaritiesCommand> logger)
    : AsyncCommand<CalculateSimilaritiesCommand.Settings>
{
    /// <summary>
    /// Command arguments.
    /// </summary>
    public class Settings : CommandSettings
    {
        /// <summary>
        /// Number of problems to process in this similarity calculation session.
        /// </summary>
        [CommandOption("-n|--count", isRequired: true)]
        [Description("Number of problems to process for similarity calculation.")]
        public required int Count { get; set; }

        /// <summary>
        /// Whether to skip problems that already have similarity relationships.
        /// </summary>
        [CommandOption("--skip-processed")]
        [Description("Skip problems that already have similarity relationships calculated.")]
        public bool SkipProcessed { get; set; }
    }

    /// <inheritdoc/>
    public override async Task<int> ExecuteAsync(CommandContext context, Settings settings)
    {
        #region Load the problems to process

        // Log loading
        logger.LogInformation("Loading problems for processing");

        // Retrieve the problems that need similarity calculation based on user settings.
        var problemsToProcess = await problemDataService.GetProblemsForSimilarityCalculationAsync(
            takeCount: settings.Count,
            skipAlreadyProcessedProblems: settings.SkipProcessed);

        // If no problems found to process.
        if (problemsToProcess.Count == 0)
        {
            // Say there's nothing to process
            logger.LogInformation("No problems found to process with the specified criteria");

            // This is fine
            return 0;
        }

        #endregion

        #region Process problems one by one - calculate and store in single loop

        // Log start
        logger.LogInformation("Starting to process {Count} problems", problemsToProcess.Count);

        // The run's tallies: the problems processed and the relationships created.
        var processedProblems = 0;
        var totalRelationshipsCreated = 0;

        // Score and store each problem's similarities, one at a time, logging progress after each
        await ProgressHelper.ExecuteWithProgressAsync(
            logger,
            problemsToProcess,
            "Processing problem similarities",
            getItemDescription: problem => problem.Slug.ToUpperInvariant(),
            processItem: async problem =>
            {
                // Check if this problem already has similarity relationships and should be skipped.
                if (settings.SkipProcessed && await databaseService.HasExistingSimilaritiesAsync(problemId: problem.Id))
                    return;

                // Score and store the problem's similarities, logging a failure without stopping the run
                try
                {
                    // Load the source problem data needed for similarity calculations.
                    var sourceProblem = await problemDataService.GetProblemSimilarityDataAsync(problemId: problem.Id);

                    // Score the problem's similarities
                    var similarityResults =
                        await problemSimilarityService.CalculateProblemSimilaritiesAsync(sourceProblem);

                    // Store similarity results immediately
                    await databaseService.StoreSimilarityResultsAsync(problem.Id, similarityResults);

                    // Update statistics
                    processedProblems++;
                    totalRelationshipsCreated += similarityResults.Count;
                }
                catch (Exception exception)
                {
                    // Log the error
                    logger.LogError(exception, "Error processing {Slug}", problem.Slug.ToUpperInvariant());
                }
            }
        );

        #endregion

        #region Report results

        // Report completion with summary statistics, as a warning when any problem went unprocessed
        logger.Log(processedProblems == problemsToProcess.Count ? LogLevel.Information : LogLevel.Warning,
            "Similarity calculation complete. " +
            "Created {Relationships} relationships for {Processed} of {Total} problems",
            totalRelationshipsCreated, processedProblems, problemsToProcess.Count);

        #endregion

        // Yay
        return 0;
    }
}

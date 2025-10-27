using MathComps.Cli.Similarity.Services;
using Spectre.Console;
using Spectre.Console.Cli;
using System.ComponentModel;

namespace MathComps.Cli.Similarity.Commands;

/// <summary>
/// Orchestrates similarity calculation for math problems using a multi-signal approach.
/// Processes problems one-by-one, combining precomputed semantic embeddings, tag overlap,
/// and competition relationships to find and store similarity relationships. Supports
/// individual problem processing with progress tracking and configurable quality gates.
/// The algorithm is as follows:
/// <list type="number">
/// <item>Load individual problem data from database</item>
/// <item>Calculate comprehensive similarities using unified service</item>
/// <item>Store similarity results in database</item>
/// <item>Move to next problem</item>
/// </list>
/// </summary>
/// <param name="problemDataService">Service for loading individual problem data from database.</param>
/// <param name="problemSimilarityService">Service for calculating comprehensive problem similarities configured with IOptions pattern.</param>
/// <param name="databaseService">Service for storing similarity results.</param>
[Description("Calculate similarity relationships between problems using embeddings, tags, and competition context.")]
public class CalculateSimilaritiesCommand(
    IProblemDataService problemDataService,
    IProblemSimilarityService problemSimilarityService,
    ISimilarityDatabaseService databaseService)
    : AsyncCommand<CalculateSimilaritiesCommand.Settings>
{
    /// <summary>
    /// Command arguments.
    /// </summary>
    public class Settings : CommandSettings
    {
        /// <summary>
        /// Number of problems to process in this similarity calculation session.
        /// Controls the scope of work for each command execution.
        /// </summary>
        [CommandOption("-n|--count")]
        [Description("Number of problems to process for similarity calculation.")]
        public required int Count { get; set; }

        /// <summary>
        /// Whether to skip problems that already have similarity relationships.
        /// This allows efficient processing of only problems without existing similarities.
        /// </summary>
        [CommandOption("--skip-processed")]
        [Description("Skip problems that already have similarity relationships calculated.")]
        [DefaultValue(false)]
        public bool SkipProcessed { get; set; }
    }

    /// <inheritdoc/>
    public override async Task<int> ExecuteAsync(CommandContext context, Settings settings)
    {
        #region Load configuration and validate parameters

        // Log loading
        AnsiConsole.MarkupLine("[dim]Loading problems for processing.[/]");

        // Retrieve the problems that need similarity calculation based on user settings.
        var problemsToProcess = await problemDataService.GetProblemsForSimilarityCalculationAsync(
            takeCount: settings.Count,
            skipAlreadyProcessedProblems: settings.SkipProcessed);

        // If no problems found to process.
        if (problemsToProcess.Count == 0)
        {
            // Make aware
            AnsiConsole.MarkupLine("[yellow]No problems found to process with the specified criteria.[/]");

            // This is fine
            return 0;
        }

        #endregion

        #region Process problems one by one - calculate and store in single loop

        // Log start
        AnsiConsole.MarkupLine($"[dim]Starting to process [yellow]{problemsToProcess.Count}[/] problems.[/]");

        // Track summary statistics for reporting.
        var processedProblems = 0;
        var totalRelationshipsCreated = 0;

        // Use Spectre.Console's Progress UI to provide a rich, real-time view of the processing.
        await AnsiConsole.Progress()
            .AutoClear(enabled: false)
            .Columns([
                new TaskDescriptionColumn(),
                new ProgressBarColumn(),
                new PercentageColumn(),
                new SpinnerColumn(),
            ])
            .StartAsync(async progressContext =>
            {
                // Create progress task for the entire processing pipeline
                var processingTask = progressContext.AddTask("[green]Processing problem similarities[/]", maxValue: problemsToProcess.Count);
                processingTask.StartTask();

                // Process each problem individually: calculate similarities and store immediately.
                for (var i = 0; i < problemsToProcess.Count; i++)
                {
                    // Get the problem
                    var problem = problemsToProcess[i];

                    // Update progress description to show current problem context and failure count.
                    var processedCountText = processedProblems > 0 ? $" [dim green]({processedProblems} processed)[/]" : "";
                    processingTask.Description = $"[green]{i + 1:N0} of {problemsToProcess.Count:N0}[/]{processedCountText} [dim]({problem.Slug.ToUpperInvariant()})[/]";

                    try
                    {
                        // Check if this problem already has similarity relationships and should be skipped.
                        if (settings.SkipProcessed && await databaseService.HasExistingSimilaritiesAsync(problemId: problem.Id))
                        {
                            // If so, move on
                            processingTask.Increment(1);
                            continue;
                        }

                        // Load the source problem data needed for similarity calculations.
                        var sourceProblem = await problemDataService.GetProblemSimilarityDataAsync(problemId: problem.Id);

                        // Calculate comprehensive similarity scores
                        // This orchestrates candidate identification and similarity calculation in a single operation.
                        var similarityResults = await problemSimilarityService.CalculateProblemSimilaritiesAsync(sourceProblem);

                        // Store similarity results immediately.
                        await databaseService.StoreSimilarityResultsAsync(problem.Id, similarityResults);

                        // Update statistics.
                        processedProblems++;
                        totalRelationshipsCreated += similarityResults.Count;
                    }
                    catch (Exception exception)
                    {
                        // Log the error and add to failed list.
                        AnsiConsole.MarkupLine($"[red]Error processing {problem.Slug.ToUpperInvariant()}: {exception.Message}[/]");
                    }

                    // One more problem done
                    processingTask.Increment(1);
                }

                // We're done with all problems
                processingTask.StopTask();
            });

        #endregion

        #region Report results

        // Report completion with summary statistics
        AnsiConsole.MarkupLine($"[bold green]Similarity calculation complete.[/] Created {totalRelationshipsCreated:N0} relationships for {processedProblems:N0} problems.");

        #endregion

        // Yay
        return 0;
    }
}

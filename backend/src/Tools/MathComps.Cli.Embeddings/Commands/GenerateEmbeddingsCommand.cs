using MathComps.Cli.Embeddings.Dtos;
using MathComps.Cli.Embeddings.Services;
using MathComps.Domain.Constants;
using MathComps.Domain.EfCoreEntities;
using Spectre.Console;
using Spectre.Console.Cli;
using System.ComponentModel;

namespace MathComps.Cli.Embeddings.Commands;

/// <summary>
/// Generates vector embeddings for problem statements and solutions using the Gemini API.
/// Creates multiple embedding types (semantic and retrieval) for both statement-only and
/// solution-only to support different search scenarios.
/// </summary>
/// <param name="geminiService">The service responsible for making calls to the Gemini embedding API.</param>
/// <param name="databaseService">The database service for accessing and storing problem embeddings.</param>
[Description("Generate vector embeddings for problems using Gemini API. Supports batch processing and force regeneration.")]
public class GenerateEmbeddingsCommand(
    IGeminiEmbeddingService geminiService,
    IEmbeddingDatabaseService databaseService) : AsyncCommand<GenerateEmbeddingsCommand.Settings>
{
    /// <summary>
    /// The command arguments
    /// </summary>
    public class Settings : CommandSettings
    {
        /// <summary>
        /// Batch size limit to control API costs and processing time.
        /// </summary>
        [Description("Number of problems to process")]
        [CommandOption("-n|--count", isRequired: true)]
        public required int Count { get; set; }

        /// <summary>
        /// When true, regenerates embeddings even if they already exist in the database.
        /// Useful for updating embeddings after model changes or improvements.
        /// </summary>
        [Description("Force regeneration of existing embeddings")]
        [CommandOption("-f|--force")]
        public bool Force { get; set; }

        /// <summary>
        /// The Gemini embedding model identifier to use for generating embeddings.
        /// Different models may have different vector dimensions and quality characteristics.
        /// </summary>
        [Description("Gemini embedding model to use")]
        [CommandOption("--model")]
        public string Model { get; set; } = "gemini-embedding-001";

        /// <summary>
        /// Number of problems to process in a single batch API call.
        /// Larger batches improve throughput but may fail together if one problem has issues.
        /// </summary>
        [Description("Batch size for Gemini requests")]
        [CommandOption("-b|--batch-size")]
        public int BatchSize { get; set; } = 20;
    }

    /// <inheritdoc />
    public override async Task<int> ExecuteAsync(CommandContext context, Settings settings)
    {
        // Log start
        AnsiConsole.MarkupLine("[bold cyan]Starting embedding generation...[/]");

        #region Load problems that need embeddings

        // Retrieve problems that need embeddings based on user settings
        var problems = await databaseService.GetProblemsNeedingEmbeddingsAsync(
            settings.Count,
            settings.Force);

        // If no problems found to process
        if (problems.Count == 0)
        {
            // Make aware
            AnsiConsole.MarkupLine("[green]No problems need embeddings![/]");

            // Exit successfully
            return 0;
        }

        // Display count of problems to be processed
        AnsiConsole.MarkupLine($"Found [yellow]{problems.Count}[/] problems to process.");

        #endregion

        #region Process problems with embedding generation

        // Track successfully processed problems for final summary
        var processedCount = 0;

        // Ensure batch size is at least 1 to avoid division by zero
        var batchSize = Math.Max(1, settings.BatchSize);

        // Use Spectre.Console's Progress UI to provide a rich, real-time view of the embedding process
        await AnsiConsole.Progress()
            .AutoClear(enabled: false)
            .Columns(
            [
                new TaskDescriptionColumn(),
                new ProgressBarColumn(),
                new PercentageColumn(),
                new RemainingTimeColumn(),
                new SpinnerColumn(),
            ])
            .StartAsync(async ctx =>
            {
                // Create progress task for embedding generation phase
                var task = ctx.AddTask("[cyan]Generating embeddings[/]", maxValue: problems.Count);
                task.StartTask();

                // Process problems in batches to optimize API calls
                for (var i = 0; i < problems.Count; i += batchSize)
                {
                    // Slice the next chunk while keeping order stable for deterministic saves
                    var batch = problems.Skip(i).Take(batchSize).ToList();

                    // Update progress description to show batch being processed
                    var firstProblem = batch.First();
                    task.Description = $"[cyan]Embedding batch starting with {firstProblem.Slug.ToUpperInvariant()}[/] [dim]({processedCount + 1}-{processedCount + batch.Count}/{problems.Count})[/]";

                    try
                    {
                        // Optimistically process the entire batch via the shared Gemini call
                        await ProcessBatchAsync(batch, settings.Model);
                        processedCount += batch.Count;
                        task.Increment(batch.Count);
                    }
                    catch (Exception batchException)
                    {
                        // Log the batch-level failure with enough detail for investigation
                        AnsiConsole.MarkupLine($"[red]Error processing batch starting with problem {firstProblem.Id}: {batchException.Message}[/]");
                        AnsiConsole.WriteException(batchException);

                        // Fall back to individual processing to salvage what we can
                        foreach (var problem in batch)
                        {
                            try
                            {
                                // Process single problem with same logic as batch
                                await ProcessProblemAsync(problem, settings.Model);
                                processedCount++;
                                task.Increment(1);
                            }
                            catch (Exception problemException)
                            {
                                // Capture the specific problem failure for later retries
                                AnsiConsole.MarkupLine($"[red]Error processing problem {problem.Id}: {problemException.Message}[/]");
                                AnsiConsole.WriteException(problemException);
                            }
                        }
                    }
                }

                // Mark embedding generation phase as complete
                task.StopTask();
            });

        #endregion

        #region Display completion summary

        // Confirm successful completion with summary statistics
        AnsiConsole.MarkupLine($"[green]Successfully processed {processedCount} problems![/]");

        #endregion

        return 0;
    }

    /// <summary>
    /// Generates embeddings for a batch of problems using the configured <see cref="IGeminiEmbeddingService"/>.
    /// Optimizes API calls by batching multiple problems together in single requests.
    /// </summary>
    /// <param name="batch">The problems to process.</param>
    /// <param name="modelName">The Gemini model to use for embedding creation.</param>
    /// <returns>A task that completes when the embeddings are generated and persisted.</returns>
    private async Task ProcessBatchAsync(IReadOnlyList<ProblemForEmbeddingDto> batch, string modelName)
    {
        // Guard against empty batches
        if (batch.Count == 0)
            return;

        // Generate embeddings for all problems in the batch
        var embeddingsByProblem = await GenerateEmbeddingsForProblemsAsync(batch, modelName);

        // Save embeddings for each problem
        foreach (var (problem, embeddings) in batch.Zip(embeddingsByProblem))
            await databaseService.SaveEmbeddingsAsync(problem.Id, embeddings);
    }

    /// <summary>
    /// Generates embeddings for a single problem, including its solution when present.
    /// Falls back to this method when batch processing fails for error recovery.
    /// </summary>
    /// <param name="problem">The problem to process.</param>
    /// <param name="modelName">The Gemini model to use for embedding creation.</param>
    /// <returns>A task that completes when the embeddings are generated and persisted.</returns>
    private async Task ProcessProblemAsync(ProblemForEmbeddingDto problem, string modelName)
    {
        // Reuse the same logic as batch processing for a single problem
        var embeddingsByProblem = await GenerateEmbeddingsForProblemsAsync([problem], modelName);
        var embeddings = embeddingsByProblem[0];

        // Save all embeddings to database
        await databaseService.SaveEmbeddingsAsync(problem.Id, embeddings);
    }

    /// <summary>
    /// Core embedding generation logic shared by both batch and single-problem processing.
    /// Generates four types of embeddings for each problem:
    /// - Statement semantic (RetrievalQuery): for similarity search on problem statements
    /// - Statement retrieval (RetrievalDocument): for document retrieval on problem statements
    /// - Solution semantic (RetrievalQuery): for similarity search on solutions (if solution exists)
    /// - Solution retrieval (RetrievalDocument): for document retrieval on solutions (if solution exists)
    /// </summary>
    /// <param name="problems">The problems to generate embeddings for.</param>
    /// <param name="modelName">The Gemini model to use for embedding creation.</param>
    /// <returns>A list of embedding collections, one per problem in the same order as input.</returns>
    private async Task<List<List<ProblemEmbeddingUpsertDto>>> GenerateEmbeddingsForProblemsAsync(
        IReadOnlyList<ProblemForEmbeddingDto> problems,
        string modelName)
    {
        // Timestamp for all embeddings in this batch
        var timestamp = DateTime.UtcNow;

        // Decompose the batch into the texts that will be embedded together
        var statementTexts = problems.Select(problem => problem.Statement).ToArray();

        // Single Gemini call for all statements improves throughput (semantic search)
        var statementSemanticEmbeddings = await geminiService.GenerateEmbeddingsAsync(
            modelName,
            statementTexts,
            EmbeddingConstants.Types.RetrievalQuery,
            EmbeddingConstants.VectorDimensions);

        // Fetch retrieval embeddings in the same batch window to keep shapes aligned
        var statementRetrievalEmbeddings = await geminiService.GenerateEmbeddingsAsync(
            modelName,
            statementTexts,
            EmbeddingConstants.Types.RetrievalDocument,
            EmbeddingConstants.VectorDimensions);

        // Track problems that include solutions to prepare solution embeddings
        var problemsWithSolutions = problems
            .Select((problem, index) => (problem, index))
            .Where(tuple => !string.IsNullOrEmpty(tuple.problem.Solution))
            .ToArray();

        // Initialize empty arrays for solution embeddings
        var solutionSemanticEmbeddings = Array.Empty<float[]>();
        var solutionRetrievalEmbeddings = Array.Empty<float[]>();
        var solutionIndexLookup = new Dictionary<Guid, int>();

        // Generate solution embeddings only if there are problems with solutions
        if (problemsWithSolutions.Length > 0)
        {
            // Extract the solution texts
            var solutionTexts = problemsWithSolutions
                .Select(tuple => tuple.problem.Solution!)
                .ToArray();

            // Generate embeddings for solution semantics (semantic search)
            solutionSemanticEmbeddings = await geminiService.GenerateEmbeddingsAsync(
                modelName,
                solutionTexts,
                EmbeddingConstants.Types.RetrievalQuery,
                EmbeddingConstants.VectorDimensions);

            // Generate embeddings tailored for retrieval scenarios as well
            solutionRetrievalEmbeddings = await geminiService.GenerateEmbeddingsAsync(
                modelName,
                solutionTexts,
                EmbeddingConstants.Types.RetrievalDocument,
                EmbeddingConstants.VectorDimensions);

            // Remember how to map a problem id back to its solution embedding index
            for (var problemIndex = 0; problemIndex < problemsWithSolutions.Length; problemIndex++)
                solutionIndexLookup[problemsWithSolutions[problemIndex].problem.Id] = problemIndex;
        }

        // Build the embedding collections for each problem
        var result = new List<List<ProblemEmbeddingUpsertDto>>();

        // Go through all the problems
        foreach (var (problem, semantic, retrival) in problems.Zip(statementSemanticEmbeddings, statementRetrievalEmbeddings))
        {
            // Start with the two baseline embeddings that every problem receives
            var embeddings = new List<ProblemEmbeddingUpsertDto>
            {
                // Semantic
                new(
                    DocumentType.Statement,
                    EmbeddingConstants.Types.RetrievalQuery,
                    modelName,
                    semantic,
                    timestamp),

                // Retrieval
                new(
                    DocumentType.Statement,
                    EmbeddingConstants.Types.RetrievalDocument,
                    modelName,
                    retrival,
                    timestamp)
            };

            // Augment the embedding set with standalone solution vectors when available
            if (solutionIndexLookup.TryGetValue(problem.Id, out var solutionIndex))
            {
                // Semantic
                embeddings.Add(new ProblemEmbeddingUpsertDto(
                    DocumentType.Solution,
                    EmbeddingConstants.Types.RetrievalQuery,
                    modelName,
                    solutionSemanticEmbeddings[solutionIndex],
                    timestamp));

                // Retrieval
                embeddings.Add(new ProblemEmbeddingUpsertDto(
                    DocumentType.Solution,
                    EmbeddingConstants.Types.RetrievalDocument,
                    modelName,
                    solutionRetrievalEmbeddings[solutionIndex],
                    timestamp));
            }

            // Remember all embeddings for the problem
            result.Add(embeddings);
        }

        // We're done
        return result;
    }
}

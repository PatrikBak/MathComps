using MathComps.Cli.Embeddings.Dtos;
using MathComps.Cli.Embeddings.Services;
using MathComps.Domain.Constants;
using MathComps.Domain.EfCoreEntities;
using Microsoft.Extensions.Logging;
using Spectre.Console.Cli;
using System.ComponentModel;
using MathComps.Shared.Extensions;
using MathComps.Shared.Cli.Progress;

namespace MathComps.Cli.Embeddings.Commands;

/// <summary>
/// Generates vector embeddings for problem statements and solutions using the Gemini API. Each problem gets a semantic
/// and a retrieval embedding of its statement, and of its solution when it has one.
/// </summary>
/// <param name="geminiService">The service responsible for making calls to the Gemini embedding API.</param>
/// <param name="databaseService">
/// The service that reads the problems needing embeddings and saves their embeddings.
/// </param>
/// <param name="logger">The logger the run's progress and failures go through.</param>
[Description("Generate vector embeddings for problems using Gemini API. " +
    "Supports batch processing and force regeneration.")]
public class GenerateEmbeddingsCommand(
    IGeminiEmbeddingService geminiService,
    IEmbeddingDatabaseService databaseService,
    ILogger<GenerateEmbeddingsCommand> logger) : AsyncCommand<GenerateEmbeddingsCommand.Settings>
{
    /// <summary>
    /// The command arguments
    /// </summary>
    public class Settings : CommandSettings
    {
        /// <summary>
        /// How many problems to embed in this run.
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
        /// </summary>
        [Description("Gemini embedding model to use")]
        [CommandOption("--model")]
        [DefaultValue("gemini-embedding-001")]
        public string Model { get; set; } = null!;

        /// <summary>
        /// How many problems share each Gemini request. A batch that fails is retried one problem at a time.
        /// </summary>
        [Description("Batch size for Gemini requests")]
        [CommandOption("-b|--batch-size")]
        [DefaultValue(20)]
        public int BatchSize { get; set; }
    }

    /// <inheritdoc />
    public override async Task<int> ExecuteAsync(CommandContext context, Settings settings)
    {
        // Log start
        logger.LogInformation("Starting embedding generation");

        #region Load problems that need embeddings

        // The problems needing embeddings, up to the requested count (already-embedded ones too when forcing)
        var problems = await databaseService.GetProblemsNeedingEmbeddingsAsync(
            settings.Count,
            settings.Force);

        // If no problems found to process
        if (problems.Count == 0)
        {
            // Say there's nothing to embed
            logger.LogInformation("No problems need embeddings");

            // Exit successfully
            return 0;
        }

        // Report how many problems will be processed
        logger.LogInformation("Found {Count} problems to process", problems.Count);

        #endregion

        #region Process problems with embedding generation

        // How many problems got their embeddings
        var processedCount = 0;

        // Create batches from the problems list
        var batches = problems.Batch(settings.BatchSize).ToList();

        // Embed the batches one at a time, logging a progress line after each
        await ProgressHelper.ExecuteWithProgressAsync(
            logger,
            batches,
            "Generating embeddings",
            getItemDescription: batch =>
                ProgressHelper.NiceBatchDescription(batch, problem => problem.Slug.ToUpperInvariant()),
            processItem: async batch =>
            {
                // Embed the whole batch, falling back to one problem at a time when it fails
                try
                {
                    // Embed the whole batch
                    await ProcessBatchAsync(batch, settings.Model);

                    // Count every problem in it as done
                    processedCount += batch.Count;
                }
                catch (Exception batchException)
                {
                    // Warn that the batch failed
                    logger.LogWarning(batchException, "Error processing batch starting with problem {ProblemId}",
                        batch.First().Id);

                    // Fall back to individual processing to salvage what we can
                    foreach (var problem in batch)
                    {
                        // Embed this problem on its own
                        try
                        {
                            // Embed the problem
                            await ProcessProblemAsync(problem, settings.Model);

                            // Count it as done
                            processedCount++;
                        }
                        catch (Exception problemException)
                        {
                            // Log the problem's failure; a re-run picks it up again
                            logger.LogError(problemException, "Error processing problem {ProblemId}", problem.Id);
                        }
                    }
                }
            }
        );

        #endregion

        #region Completion summary

        // Report how many problems got their embeddings, as a warning when some did not
        logger.Log(processedCount == problems.Count ? LogLevel.Information : LogLevel.Warning,
            "Processed {Processed} of {Total} problems", processedCount, problems.Count);

        #endregion

        // Done, even when some problems failed; the summary already warned
        return 0;
    }

    /// <summary>
    /// Generates and saves the embeddings of a batch of problems, every problem's texts sharing each
    /// <see cref="IGeminiEmbeddingService"/> request.
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
    /// Generates and saves the embeddings of a single problem, its solution's included when it has one.
    /// </summary>
    /// <param name="problem">The problem to process.</param>
    /// <param name="modelName">The Gemini model to use for embedding creation.</param>
    /// <returns>A task that completes when the embeddings are generated and persisted.</returns>
    private async Task ProcessProblemAsync(ProblemForEmbeddingDto problem, string modelName)
    {
        // The problem's embeddings, generated as a batch of one
        var embeddingsByProblem = await GenerateEmbeddingsForProblemsAsync([problem], modelName);
        var embeddings = embeddingsByProblem[0];

        // Save all embeddings to database
        await databaseService.SaveEmbeddingsAsync(problem.Id, embeddings);
    }

    /// <summary>
    /// Generates the embeddings of each problem: a semantic
    /// (<see cref="EmbeddingConstants.Types.RetrievalQuery"/>) and a retrieval
    /// (<see cref="EmbeddingConstants.Types.RetrievalDocument"/>) embedding of its statement, and of its solution when
    /// it has one.
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

        // Every problem's statement
        var statementTexts = problems.Select(problem => problem.Statement).ToArray();

        // Semantic embeddings of every statement
        var statementSemanticEmbeddings = await geminiService.GenerateEmbeddingsAsync(
            modelName,
            statementTexts,
            EmbeddingConstants.Types.RetrievalQuery,
            EmbeddingConstants.VectorDimensions);

        // Retrieval embeddings of every statement
        var statementRetrievalEmbeddings = await geminiService.GenerateEmbeddingsAsync(
            modelName,
            statementTexts,
            EmbeddingConstants.Types.RetrievalDocument,
            EmbeddingConstants.VectorDimensions);

        // The problems that have a solution
        var problemsWithSolutions = problems
            .Select((problem, index) => (problem, index))
            .Where(tuple => !string.IsNullOrEmpty(tuple.problem.Solution))
            .ToArray();

        // The solution embeddings, empty when no problem has a solution
        var solutionSemanticEmbeddings = Array.Empty<float[]>();
        var solutionRetrievalEmbeddings = Array.Empty<float[]>();

        // Each solved problem's id mapped to its position among the solution embeddings
        var solutionIndexLookup = new Dictionary<Guid, int>();

        // Generate solution embeddings only if there are problems with solutions
        if (problemsWithSolutions.Length > 0)
        {
            // Extract the solution texts
            var solutionTexts = problemsWithSolutions
                .Select(tuple => tuple.problem.Solution!)
                .ToArray();

            // Semantic embeddings of every solution
            solutionSemanticEmbeddings = await geminiService.GenerateEmbeddingsAsync(
                modelName,
                solutionTexts,
                EmbeddingConstants.Types.RetrievalQuery,
                EmbeddingConstants.VectorDimensions);

            // Retrieval embeddings of every solution
            solutionRetrievalEmbeddings = await geminiService.GenerateEmbeddingsAsync(
                modelName,
                solutionTexts,
                EmbeddingConstants.Types.RetrievalDocument,
                EmbeddingConstants.VectorDimensions);

            // Remember how to map a problem id back to its solution embedding index
            for (var problemIndex = 0; problemIndex < problemsWithSolutions.Length; problemIndex++)
                solutionIndexLookup[problemsWithSolutions[problemIndex].problem.Id] = problemIndex;
        }

        // One embedding list per problem, in input order
        var result = new List<List<ProblemEmbeddingUpsertDto>>();

        // Build each problem's embeddings
        foreach (var (problem, semantic, retrieval) in
                 problems.Zip(statementSemanticEmbeddings, statementRetrievalEmbeddings))
        {
            // Start with the statement's embeddings, which every problem gets
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
                    retrieval,
                    timestamp)
            };

            // Add the solution's embeddings when the problem has one
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

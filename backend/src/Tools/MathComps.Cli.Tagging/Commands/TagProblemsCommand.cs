using MathComps.Cli.Tagging.Commands.Helpers;
using MathComps.Cli.Tagging.Constants;
using MathComps.Cli.Tagging.Dtos;
using MathComps.Cli.Tagging.Services;
using MathComps.Cli.Tagging.Settings;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Options;
using MathComps.Infrastructure.Services;
using MathComps.Shared;
using MathComps.Shared.Cli;
using Microsoft.Extensions.Options;
using Spectre.Console;
using Spectre.Console.Cli;
using System.Collections.Immutable;
using System.ComponentModel;

namespace MathComps.Cli.Tagging.Commands;

/// <summary>
/// Gets problems from the database, uses AI to suggest tags based on problem statements and solutions,
/// and updates the database with these tags. Supports options for dry runs, batch sizes, and
/// tag selection filtering.
/// </summary>
/// <param name="databaseService">The database service for accessing problem and tag data.</param>
/// <param name="tagProblemsOptions">Configuration settings specific for this command.</param>
/// <param name="geminiService">The service responsible for making calls to the Gemini API.</param>
[Description($"""
    Automatically tag problems using AI analysis with categorized approved tag vocabulary.
    Stores logs in the '{LoggingConstants.LogsDirectory}' folder; these can be used to inspect the process in detail.
    Reasoning behind tags derived from the problem statement can be found in '<problem>.statement.json'
    files; for tags derived using problem solution too (i.e. technique tags), see '<problem>.solution.json'.
    Prompts sent to the LLM are stored in '<problem>.statement.prompt.txt' / '<problem>.solution.prompt.txt'.
""")]
public class TagProblemsCommand(
    ITaggingDatabaseService databaseService,
    IOptions<TagProblemsSettings> tagProblemsOptions,
    IGeminiService geminiService)
    : AsyncCommand<TagProblemsCommand.Settings>
{
    /// <summary>
    /// The command arguments
    /// </summary>
    public class Settings : CommandSettings
    {
        /// <summary>
        /// Safety mode: preview tag suggestions without database modifications.
        /// Essential for testing AI behavior and validating tag quality before committing changes.
        /// </summary>
        [CommandOption("--dry-run")]
        [Description("Perform a dry run without making any changes to the database.")]
        public bool DryRun { get; set; }

        /// <summary>
        /// Batch size limit to control AI API costs and processing time.
        /// </summary>
        [CommandOption("-n|--count", isRequired: true)]
        [Description("Number of problems to tag.")]
        public required int Count { get; set; }


        /// <summary>
        /// If set, clears all tags of all problems. If specified together with a tag selection,
        /// clears only the tags from the tag selection.
        /// </summary>
        [CommandOption("--clear-tags")]
        [Description("Clears all tags before tagging. If specified together with a tag selection, clears only those tags.")]
        public bool ClearTags { get; set; }

        /// <summary>
        /// This specified how much we wanna spam Gemini in parallel.
        /// </summary>
        [CommandOption("--num-threads")]
        [Description("Number of threads to run the tagging in parallel. Note: make sure to take into account model rate limits when setting this.")]
        [DefaultValue(1)]
        public int NumThreads { get; set; }

        /// <summary>
        /// Specifies a file containing a list of tags to consider for tagging.
        /// </summary>
        [CommandOption("--tag-selection-file")]
        [Description("Consider only some subset of tags. Argument should be path to a file, where each line contains the name of one tag.")]
        public string? TagSelectionFile { get; set; }
    }

    /// <inheritdoc/>
    public override async Task<int> ExecuteAsync(CommandContext context, Settings settings)
    {
        // Ensure logs directory exists for storing AI interaction logs
        Directory.CreateDirectory(LoggingConstants.LogsDirectory);

        #region Load configuration and initial data

        // Initialize tag selector to include all tags by default
        Func<string, bool> tagNameFilter = _ => true;

        // Load the approved tags from the tag files
        var tagsSelection = TagFilesHelper.GetCategorizedApprovedTags().Simple();

        // If a tag selection file is provided...
        if (settings.TagSelectionFile != null)
        {
            // Read the specified tags from the file
            var tags = File.ReadAllLines(settings.TagSelectionFile).ToHashSet();

            // Filter out the loaded tags from the approved ones
            tagsSelection = tagsSelection.Filter(
                tags.ToImmutableDictionary(tagName => tagName, tagName => true),
                out var _,
                out var _
            );

            // We will select only from there tags
            tagNameFilter = tags.Contains;
        }

        // If specified, clear existing tags before tagging
        if (settings.ClearTags)
            await databaseService.RemoveTagsFromAllProblemsAsync([.. tagsSelection.Data.Values.Flatten()]);

        // Retrieve the problems that need tagging based on user settings
        var problemsToTag = await databaseService.GetProblemsToTagAsync(
            settings.Count,
            tagsSelection
        );

        // If no problems found to process
        if (problemsToTag.Count == 0)
        {
            // Make aware
            AnsiConsole.MarkupLine("[yellow]No problems found to tag with the specified criteria.[/]");

            // Exit successfully
            return 0;
        }

        #endregion

        #region Process problems with AI tagging

        // Create timestamp for organizing log files by execution time
        var datetimeString = $"{DateTime.Now:yyyy-MM-dd_HH-mm-ss}";

        // Initialize the main log file for tracking tagging operations
        var logPath = $"{LoggingConstants.LogsDirectory}/{LoggingConstants.TagProblemsLogFile}";
        File.WriteAllText(logPath, "");

        // Use the progress helper to process problems with AI tagging in parallel
        await ProgressHelper.ExecuteWithProgressInParallelAsync(
            problemsToTag,
            "Processing problems for AI tagging...",
            getItemDescription: problem => problem.Slug.ToUpperInvariant(),
            numThreads: settings.NumThreads,
            processItem: async (problem, index, cancellationToken) =>
            {
                // Process statement tags (Area/Goal/Type) for this problem
                var statementTagsAsync = TagProblem(
                    datetimeString,
                    "statement",
                    tagProblemsOptions.Value.TagProblemStatement,
                    tagData => tagData.TagType != TagType.Technique && tagNameFilter(tagData.TagName),
                    problem);

                // Initialize technique tags as empty (will be populated if solution exists)
                var techniqueTagsAsync = Task.FromResult(new Dictionary<string, ProblemTagData>().ToImmutableDictionary());

                // Problems with solution
                if (problem.Solution != null)
                {
                    // Get technique tags too
                    techniqueTagsAsync = TagProblem(
                        datetimeString,
                        "solution",
                        tagProblemsOptions.Value.TagProblemSolution,
                        tagData => tagData.TagType == TagType.Technique && tagNameFilter(tagData.TagName),
                        problem
                    );
                }

                // Wait for both statement and technique tag processing to complete
                var statementTags = await statementTagsAsync;
                var techniqueTags = await techniqueTagsAsync;

                // Combine all suggested tags from both analyses
                return statementTags.Union(techniqueTags).ToImmutableDictionary();
            },
            handleResult: async (suggestedTags, problem, index, cancellationToken) =>
            {
                // Apply tag suggestions to database if not in dry-run mode
                if (suggestedTags.Count > 0 && !settings.DryRun)
                    await databaseService.AddTagsForProblemAsync(problem.Id, suggestedTags);

                // Extract high-confidence tags for logging
                var tags = suggestedTags
                    .Where(pair => pair.Value.GoodnessOfFit >= ProblemTag.MinimumGoodnessOfFitThreshold)
                    .Select(pair => pair.Key)
                    .ToJoinedString();

                // Log the tags assigned to this problem
                File.AppendAllText(logPath, $"{problem.Slug}: {tags}\n");
            }
        );

        #endregion

        #region Apply changes or report dry-run results

        // In dry-run mode, show what would happen without making database changes
        if (settings.DryRun)
        {
            // Display summary of intended changes for user review
            AnsiConsole.MarkupLine($"[bold yellow]Dry run complete.[/]");

            // Exit successfully after dry run
            return 0;
        }

        // Confirm successful completion with summary statistics
        AnsiConsole.MarkupLine($"[bold green]Database updated successfully.[/]");

        #endregion

        return 0;
    }

    /// <summary>
    /// Uses AI to analyze a problem and suggest appropriate tags based on the problem statement or solution.
    /// </summary>
    /// <param name="folder">Directory name for organizing log files by analysis type (e.g., "statement", "solution").</param>
    /// <param name="suffix">File suffix for log files to distinguish between different analysis types.</param>
    /// <param name="geminiSettings">Configuration for the Gemini AI model including prompts and parameters.</param>
    /// <param name="tagSelector">Function to filter which tags are eligible for suggestion based on their name and type.</param>
    /// <param name="problem">The problem details including statement, solution, and existing tags.</param>
    /// <returns>Dictionary of suggested tags with their confidence scores and justifications.</returns>
    private async Task<ImmutableDictionary<string, ProblemTagData>> TagProblem(
        string folder,
        string suffix,
        AiModelConfig geminiSettings,
        Func<(string TagName, TagType TagType), bool> tagSelector,
        ProblemDetailsDto problem)
    {
        // Load the system prompt template for AI interaction
        var systemPromptTemplate = await File.ReadAllTextAsync(geminiSettings.SystemPromptPath);

        // Get all approved tags for validation and filtering
        var allApprovedTags = TagFilesHelper.GetCategorizedApprovedTags().MapTagsToTheirData();

        // Identify tags that are forbidden (already assigned or not in selection)
        var tagsNotToBeUsed = allApprovedTags
            .Where(pair => problem.TagsData.ContainsKey(pair.Key) || !tagSelector((pair.Key, pair.Value.Type)))
            .Select(pair => pair.Key)
            .ToImmutableHashSet();

        // Build the list of tags that can be processed (not forbidden)
        var tagsToProcess = TagFilesHelper.GetCategorizedApprovedTags()
            .MapTagsToTheirData()
            .Where(pair => !tagsNotToBeUsed.Contains(pair.Key))
            .ToImmutableDictionary(
                pair => pair.Key,
                pair => new
                {
                    Category = pair.Value.Type.ToString(),
                    pair.Value.Description
                });

        // Get already assigned tags with their metadata for context
        var alreadyAssignedTags =
            (from problemTagPair in problem.ApprovedTags()
             join approvedTagPair in allApprovedTags on problemTagPair.Key equals approvedTagPair.Key
             select new
             {
                 Tag = problemTagPair.Key,
                 problemTagPair.Value.TagType,
                 approvedTagPair.Value.Description
             })
            .ToImmutableDictionary(
                data => data.Tag,
                data => new
                {
                    Category = data.TagType.ToString(),
                    data.Description
                });

        // If no tags can be processed, return empty result
        if (tagsToProcess.Count == 0)
            return ImmutableDictionary<string, ProblemTagData>.Empty;

        // Build context text about already assigned tags for AI
        var alreadyAssignedTagsText = alreadyAssignedTags.Count == 0 ? "" :
            $"""
             The following tags have already been assigned to the problem (you can't unassign them,
             but they may influence your decisions):
             {alreadyAssignedTags.ToJson()}
             """;

        // Build the user prompt by replacing placeholders with actual problem data
        var userPrompt = systemPromptTemplate
            .Replace("{already_assigned_tags_text}", alreadyAssignedTagsText)
            .Replace("{candidate_tags}", tagsToProcess.ToJson())
            .Replace("{problem_statement}", problem.Statement)
            .Replace("{problem_solution}", problem.Solution ?? string.Empty);

        // Prepare the log directory
        var logDirectory = $"{LoggingConstants.LogsDirectory}/{folder}";
        Directory.CreateDirectory(logDirectory);

        // Store the final prompt sent to the AI for debugging
        var userPromptPath = $"{logDirectory}/{problem.Slug}.{suffix}.prompt.txt";
        File.WriteAllText(userPromptPath, userPrompt);

        // In a try-catch
        var aiResponseRaw = await GeneralUtilities.TryExecuteAsync(() =>
            // Call the Gemini service to get tag suggestions
            geminiService.GenerateContentAsync(
                geminiSettings.Model,
                systemPromptTemplate,
                userPrompt,
                geminiSettings.ThinkingBudget
            ),
            // Provide an exception with more context
            exception => throw new InvalidOperationException("Gemini error", exception));

        // If AI service failed, return empty result
        if (aiResponseRaw is null)
            return ImmutableDictionary<string, ProblemTagData>.Empty;

        // Store the raw AI response for debugging
        var aiResponsePath = $"{logDirectory}/{problem.Slug}.{suffix}.json";
        File.WriteAllText(aiResponsePath, aiResponseRaw);

        // Parse the AI response to extract tag suggestions with fitness scores
        var suggestedTags = GeneralUtilities.TryExecute(() => (
            from suggestedTagPair in TaggingHelpers.ParseTagFitnesses(aiResponseRaw)
            join approvedTagPair in allApprovedTags on suggestedTagPair.Key equals approvedTagPair.Key
            select KeyValuePair.Create(
                suggestedTagPair.Key,
                new ProblemTagData(
                    approvedTagPair.Value.Type,
                    suggestedTagPair.Value.GoodnessOfFit,
                    suggestedTagPair.Value.Justification,
                    Confidence: 0)
                )
            )
            .ToImmutableDictionary(),
            // Provide an exception with more context
            exception => throw new InvalidOperationException("Parsing AI response failed", exception));

        // If parsing failed, return empty result
        if (suggestedTags is null)
            return ImmutableDictionary<string, ProblemTagData>.Empty;

        // Filter suggestions to only include tags that were actually candidates
        return suggestedTags.Where(pair => tagsToProcess.ContainsKey(pair.Key)).ToImmutableDictionary();
    }
}

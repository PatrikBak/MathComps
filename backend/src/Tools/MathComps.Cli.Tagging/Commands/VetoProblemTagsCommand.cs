using MathComps.Cli.Tagging.Commands.Helpers;
using MathComps.Cli.Tagging.Constants;
using MathComps.Cli.Tagging.Dtos;
using MathComps.Cli.Tagging.Services;
using MathComps.Cli.Tagging.Settings;
using MathComps.Domain.EfCoreEntities;
using MathComps.Shared;
using Microsoft.Extensions.Options;
using Spectre.Console;
using Spectre.Console.Cli;
using System.Collections.Immutable;
using System.ComponentModel;

namespace MathComps.Cli.Tagging.Commands;

/// <summary>
/// Gets problems from the database, uses AI to review and veto existing tags based on problem statements and solutions,
/// and updates the database with veto decisions. Supports options for dry runs, batch sizes, and
/// tag selection filtering.
/// </summary>
/// <param name="databaseService">The database service for accessing problem and tag data.</param>
/// <param name="vetoProblemTagsOptions">Configuration settings specific for this command.</param>
/// <param name="geminiService">The service responsible for making calls to the Gemini API.</param>
[Description($"""
    Automatically tag problems using AI analysis with categorized approved tag vocabulary.
    Stores logs in the '{LoggingConstants.LogsDirectory}' folder; these can be used to inspect the process in detail.
    Veto decisions for Area/Goal/Type tags can be found in '<problem>.statement.veto.json'
    files; decisions for technique tags are in '<problem>.solution.veto.json'.
    Prompts sent to the LLM are stored in '<problem>.statement.veto.prompt.txt' /
    '<problem>.solution.veto.prompt.txt'.
""")]
public class VetoProblemTagsCommand(
    ITaggingDatabaseService databaseService,
    IOptions<VetoProblemTagsSettings> vetoProblemTagsOptions,
    IGeminiService geminiService)
    : AsyncCommand<VetoProblemTagsCommand.Settings>
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
        [DefaultValue(false)]
        public bool DryRun { get; set; }

        /// <summary>
        /// Batch size limit to control AI API costs and processing time.
        /// </summary>
        [CommandOption("-n|--count")]
        [Description("Number of problems to process.")]
        public required int Count { get; set; }

        /// <summary>
        /// Filters only problems with confidence less than or equal to given threshold.
        /// </summary>
        [CommandOption("--max-confidence")]
        [Description("Filter only problems with confidence less than or equal to this threshold.")]
        public int MaxConfidence { get; set; } = 0;

        /// <summary>
        /// Filters only problems with goodness of fit less than or equal to given threshold (from 0 to 1).
        /// </summary>
        [CommandOption("--max-fit")]
        [Description("Filters only problems with goodness of fit less than or equal to given threshold (from 0 to 1).")]
        public float MaxGoodnessOfFit { get; set; } = 1.0f;

        /// <summary>
        /// This specified how much we wanna spam Gemini in parallel.
        /// </summary>
        [CommandOption("--num-threads")]
        [Description("Number of threads to run the vetoing in parallel. Note: make sure to take into account model rate limits when setting this.")]
        [DefaultValue(1)]
        public int NumThreads { get; set; }

        /// <summary>
        /// Specifies a file containing a list of tags to consider for vetoing.
        /// </summary>
        [CommandOption("--tag-selection-file")]
        [Description("Veto only some subset of tags. Argument should be path to a file, where each line contains the name of one tag.")]
        [DefaultValue(null)]
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
        string[]? tagSelection = null;

        // If a tag selection file is provided...
        if (settings.TagSelectionFile != null)
        {
            // Read the specified tags from the file
            var tags = File.ReadAllLines(settings.TagSelectionFile).ToHashSet();

            // We will select only from there tags
            tagNameFilter = tags.Contains;
            tagSelection = [.. tags];
        }

        // Retrieve the problems that need tag vetoing based on user settings
        var problemsToVeto = await databaseService.GetProblemsToVeto(
            settings.Count,
            settings.MaxConfidence,
            settings.MaxGoodnessOfFit,
            tagSelection
        );

        // If no problems found to process, inform user and exit
        if (problemsToVeto.Count == 0)
        {
            // Inform user that no problems match the criteria
            AnsiConsole.MarkupLine("[yellow]No problems found to veto tags with the specified criteria.[/]");

            // Exit successfully with no work to do
            return 0;
        }

        #endregion

        #region Process problems with AI tagging

        // Create timestamp for organizing log files by execution time
        var datetimeString = $"{DateTime.Now:yyyy-MM-dd_HH-mm-ss}";

        // Initialize the main log file for tracking veto operations
        var logPath = $"{LoggingConstants.LogsDirectory}/{LoggingConstants.VetoProblemsLogFile}";
        File.WriteAllText(logPath, "");

        // Use Spectre.Console's Progress UI to provide a rich, real-time view of the veto process
        await AnsiConsole.Progress()
            .AutoClear(enabled: false)
            .Columns(
            [
                new TaskDescriptionColumn(),
                new ProgressBarColumn(),
                new PercentageColumn(),
                new SpinnerColumn(),
            ])
            .StartAsync(async context =>
            {
                // Create progress task for AI processing phase
                var processingTask = context.AddTask("[green]Processing problems for AI veto[/]", maxValue: problemsToVeto.Count);
                processingTask.StartTask();

                // Process problems in parallel with configurable thread count
                await Parallel.ForAsync(0, problemsToVeto.Count, new ParallelOptions { MaxDegreeOfParallelism = settings.NumThreads },
                    async (problemIndex, cancellationToken) =>
                {
                    // Get the current problem to process
                    var problem = problemsToVeto[problemIndex];

                    // Update progress description to show current problem context
                    processingTask.Description = $"[green]Started {problemIndex + 1:N0} of {problemsToVeto.Count:N0}[/] [dim]({problem.Slug.ToUpperInvariant()})[/]";

                    // Process statement tags (Area/Goal/Type) for veto decisions
                    var approvalsStatementTask = FilterTags(
                        datetimeString,
                        "statement",
                        vetoProblemTagsOptions.Value.VetoProblemStatementTags,
                        settings,
                        tagInfo => tagInfo.TagType != TagType.Technique && tagNameFilter(tagInfo.TagName),
                        problem);

                    // Process solution tags (Technique) for veto decisions
                    var approvalsSolutionTask = FilterTags(
                        datetimeString,
                        "solution",
                        vetoProblemTagsOptions.Value.VetoProblemSolutionTags,
                        settings,
                        tagInfo => tagInfo.TagType == TagType.Technique && tagNameFilter(tagInfo.TagName),
                        problem);

                    // Combine statement and solution tag approvals into single result
                    var approvals = (await approvalsStatementTask).Union(await approvalsSolutionTask).ToImmutableDictionary();

                    // Apply veto decisions to database if not in dry-run mode
                    if (approvals.Count > 0 && !settings.DryRun)
                        await databaseService.VetoTagsForProblemAsync(problem.Id, approvals);

                    // Extract rejected and approved tag names for logging
                    var rejectedTags = approvals.Where(pair => !pair.Value).Select(pair => pair.Key).ToJoinedString();
                    var approvedTags = approvals.Where(pair => pair.Value).Select(pair => pair.Key).ToJoinedString();

                    // Thead safely
                    lock (context)
                    {
                        // Log the veto decisions for this problem
                        File.AppendAllText(logPath, $"{problem.Slug}: approved {approvedTags}; rejected {rejectedTags}\n");

                        // Increment progress
                        processingTask.Increment(1);
                    }
                });

                // Mark AI processing phase as complete
                processingTask.StopTask();
            });

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
    /// Filters problem tags using AI analysis to determine which tags should be approved or vetoed.
    /// Processes candidate tags based on confidence and goodness of fit thresholds, then uses
    /// the Gemini AI service to make approval decisions for each tag.
    /// </summary>
    /// <param name="folder">The folder name for organizing log files (e.g., "statement" or "solution").</param>
    /// <param name="suffix">The suffix for log file naming to distinguish between different tag types.</param>
    /// <param name="geminiSettings">Configuration settings for the Gemini AI model including model name and prompt paths.</param>
    /// <param name="settings">Command settings containing filtering criteria like max confidence and goodness of fit.</param>
    /// <param name="tagSelector">Function to filter which tags are eligible for vetoing based on their name and type.</param>
    /// <param name="problem">The problem details containing statement, solution, and current approved tags to analyze.</param>
    /// <returns>An immutable dictionary mapping tag names to their approval status (true for approved, false for vetoed).</returns>
    private async Task<ImmutableDictionary<string, bool>> FilterTags(
        string folder,
        string suffix,
        CommandGeminiSettings geminiSettings,
        Settings settings,
        Func<(string TagName, TagType TagType), bool> tagSelector,
        ProblemDetailsDto problem)
    {
        // Load the system prompt template for AI interaction
        var systemPrompt = await File.ReadAllTextAsync(geminiSettings.SystemPromptPath);

        // Get all valid approved tags for validation
        var validTags = TagFilesHelper.GetCategorizedApprovedTags().MapTagsToTheirData();

        // Filter candidate tags based on user criteria and build structured data for AI
        var candidateTags = (from pair in problem.ApprovedTags()
                             where pair.Value.GoodnessOfFit <= settings.MaxGoodnessOfFit &&
                                   pair.Value.Confidence != null &&
                                   pair.Value.Confidence <= settings.MaxConfidence
                             join validTagPair in validTags on pair.Key equals validTagPair.Key
                             where tagSelector((pair.Key, validTagPair.Value.Type))
                             select new
                             {
                                 TagName = pair.Key,
                                 ProblemTag = pair.Value,
                                 TagType = validTagPair.Value.Type,
                                 TagDescription = validTagPair.Value.Description
                             })
                            .ToImmutableDictionary(entry => entry.TagName, entry => new
                            {
                                tagCategory = entry.TagType,
                                tagDescription = entry.TagDescription,
                                justification = entry.ProblemTag.Justification
                            });

        // If no candidate tags meet the criteria, return empty result
        if (candidateTags.Count == 0)
            return ImmutableDictionary<string, bool>.Empty;

        // Build the user prompt by replacing placeholders with actual problem data
        var userPrompt = systemPrompt
            .Replace("{problem_statement}", problem.Statement)
            .Replace("{problem_solution}", problem.Solution ?? string.Empty)
            .Replace("{candidate_tags}", candidateTags.ToJson());

        // Prepare the log directory
        var logDirectory = $"{LoggingConstants.LogsDirectory}/{folder}";
        Directory.CreateDirectory(logDirectory);

        // Store the final prompt sent to the AI for debugging
        var userPromptPath = $"{logDirectory}/{problem.Slug}.{suffix}.veto.prompt.txt";
        File.WriteAllText(userPromptPath, userPrompt);

        // In a try-catch
        var aiResponseRaw = await GeneralUtilities.TryExecuteAsync(
            // Call the AI service to get tag approval decisions with error handling
            () => geminiService.GenerateContentAsync(
                geminiSettings.Model,
                systemPrompt,
                userPrompt,
                geminiSettings.ThinkingBudget
            ),
            // Handle AI service errors gracefully
            exception =>
            {
                // Log the problem slug and exception details
                AnsiConsole.MarkupLine($"[red]{problem.Slug.ToUpperInvariant()}[/] Gemini service errors");
                AnsiConsole.WriteException(exception);
            });

        // If AI service failed, return empty result
        if (aiResponseRaw is null)
            return ImmutableDictionary<string, bool>.Empty;

        // Store the AI response for debugging and audit purposes
        var aiResponsePath = $"{LoggingConstants.LogsDirectory}/{folder}/{problem.Slug}.{suffix}.veto.json";
        File.WriteAllText(aiResponsePath, aiResponseRaw);

        // In a try-catch
        var approvals = GeneralUtilities.TryExecute(() =>
            // Parse the AI response to extract tag approval decisions
            TaggingHelpers.ParseTagApprovals(aiResponseRaw).ToImmutableDictionary(pair => pair.Key, pair => pair.Value.Approved),
            // Handle JSON parsing errors gracefully
            exception =>
            {
                // Log the problem slug and parsing exception details
                AnsiConsole.MarkupLine($"[red]{problem.Slug.ToUpperInvariant()}[/] AI response parsing problem");
                AnsiConsole.WriteException(exception);
            });

        // If parsing failed, return empty result
        if (approvals is null)
            return ImmutableDictionary<string, bool>.Empty;

        // Filter approvals to only include tags that were actually candidates
        return approvals.Where(pair => candidateTags.ContainsKey(pair.Key)).ToImmutableDictionary();
    }
}

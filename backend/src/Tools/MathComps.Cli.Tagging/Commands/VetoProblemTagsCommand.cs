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
using System.Text.Encodings.Web;
using System.Text.Json;

namespace MathComps.Cli.Tagging.Commands;

/// <summary>
/// Filter problem tags using LLMs.
/// </summary>
/// <param name="databaseService">The database service for accessing problem and tag data.</param>
/// <param name="geminiOptions">Configuration settings specific to the Gemini model for this command.</param>
/// <param name="geminiService">The service responsible for making calls to the Gemini API.</param>
[Description("""
    Automatically tag problems using AI analysis with categorized approved tag vocabulary.
    Stores logs in the 'Logs' folder; these can be used to inspect the process in detail.
    Veto decisions for Area/Goal/Type tags can be found in '<problem>.statement.veto.json'
    files; decisions for technique tags are in '<problem>.solution.veto.json'.
    Prompts sent to the LLM are stored in '<problem>.statement.veto.prompt.txt' /
    '<problem>.solution.veto.prompt.txt'.
""")]
public class VetoProblemTagsCommand(
    ITaggingDatabaseService databaseService,
    IOptionsSnapshot<CommandGeminiSettings> geminiOptions,
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
        /// Number of threads to run the tagging in parallel.
        /// </summary>
        [CommandOption("--num-threads")]
        [Description("Number of threads to run the vetoing in parallel. Note: make sure to take into account model rate limits when setting this.")]
        [DefaultValue(1)]
        public int NumThreads { get; set; }

        /// <summary>
        /// Number of threads to run the tagging in parallel.
        /// </summary>
        [CommandOption("--tag-selection-file")]
        [Description("Veto only some subset of tags. Argument should be path to a file, where each line contains the name of one tag.")]
        [DefaultValue(null)]
        public string? TagSelectionFile { get; set; }
    }

    /// <summary>
    /// Returns a dict listing for each tag whether to remove it or not.
    /// </summary>
    private async Task<ImmutableDictionary<string, bool>> FilterTags(
        string folder,
        string suffix,
        CommandGeminiSettings geminiSettings,
        Settings settings,
        Func<string, ProblemTagData, bool> tagSelector,
        ProblemDetailsDto problem)
    {
        var systemPromptTemplate = await File.ReadAllTextAsync(geminiSettings.SystemPromptPath);

        var validTags = TagFilesHelper.GetCategorizedApprovedTags().ToDict();
        var candidateTags = problem.ApprovedTags()
            .Where(kv => tagSelector(kv.Key, kv.Value) &&
                kv.Value.GoodnessOfFit <= settings.MaxGoodnessOfFit &&
                kv.Value.Confidence != null && kv.Value.Confidence <= settings.MaxConfidence)
            .Join(validTags, pt => pt.Key, vt => vt.Key,
                (pt, vt) => new { TagName = pt.Key, ProblemTag = pt.Value, TagType = vt.Value.Type, TagDescription = vt.Value.Description }
        ).ToImmutableDictionary(entry => entry.TagName, entry => new
        {
            tagCategory = entry.TagType,
            tagDescription = entry.TagDescription,
            justification = entry.ProblemTag.Justification
        });

        if (candidateTags.Count == 0)
        {
            return new Dictionary<string, bool>().ToImmutableDictionary();
        }

        var jsonSerOptions = new JsonSerializerOptions
        {
            Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping
        };
        var userPrompt = systemPromptTemplate
            .Replace("{problem_statement}", problem.Statement)
            .Replace("{problem_solution}", problem.Solution ?? string.Empty)
            .Replace("{candidate_tags}", JsonSerializer.Serialize(candidateTags, jsonSerOptions));

        var userPromptPath = $"Logs/{folder}/{problem.Slug}.{suffix}.veto.prompt.txt";
        Directory.CreateDirectory(Path.GetDirectoryName(userPromptPath)!);
        File.WriteAllText(userPromptPath, userPrompt);

        var aiResponseRaw = await GeneralUtilities.TryExecuteAsync(() => geminiService.GenerateContentAsync(geminiSettings.Model, systemPromptTemplate, userPrompt, geminiSettings.ThinkingBudget),
            // Handle errors
            exception =>
            {
                // Log the problem
                AnsiConsole.MarkupLine($"[red]{problem.Slug.ToUpperInvariant()}[/] Gemini service errors");
                AnsiConsole.WriteException(exception);
            });

        if (aiResponseRaw is null)
        {
            return new Dictionary<string, bool>().ToImmutableDictionary();
        }

        var aiResponsePath = $"Logs/{folder}/{problem.Slug}.{suffix}.veto.json";
        Directory.CreateDirectory(Path.GetDirectoryName(aiResponsePath)!);
        File.WriteAllText(aiResponsePath, aiResponseRaw);

        // Parse the response
        var approvals = GeneralUtilities.TryExecute(() => TaggingHelpers.ParseTagApprovals(aiResponseRaw)
            .ToImmutableDictionary(kv => kv.Key, kv => kv.Value.Approved),
            // Handle exceptions
            exception =>
            {
                // Log the problem
                AnsiConsole.MarkupLine($"[red]{problem.Slug.ToUpperInvariant()}[/] AI response parsing problem");
                AnsiConsole.WriteException(exception);
            });

        if (approvals is null)
        {
            return new Dictionary<string, bool>().ToImmutableDictionary(); ;
        }

        approvals = approvals.Where(kv => candidateTags.ContainsKey(kv.Key)).ToImmutableDictionary();
        return approvals;
    }

    /// <inheritdoc/>
    public override async Task<int> ExecuteAsync(CommandContext context, Settings settings)
    {
        #region Load configuration and initial data

        Func<string, ProblemTagData, bool> tagSelector = (tag, data) => true;
        string[]? tagSelection = null;
        if (settings.TagSelectionFile != null)
        {
            tagSelection = File.ReadAllLines(settings.TagSelectionFile);
            ImmutableHashSet<string> tagsSet = [.. tagSelection];
            tagSelector = (tag, data) => tagsSet.Contains(tag);
        }

        // Retrieve the problems that need tagging based on user settings.
        var problemsToVeto = await databaseService.GetProblemsToVeto(settings.Count, settings.MaxConfidence, settings.MaxGoodnessOfFit, tagSelection);

        // If no problems found to process.
        if (problemsToVeto.Count == 0)
        {
            // Make aware
            AnsiConsole.MarkupLine("[yellow]No problems found to veto tags with the specified criteria.[/]");

            // Nothing to do
            return 0;
        }

        #endregion

        #region Process problems with AI tagging

        var datetimeString = $"{DateTime.Now:yyyy-MM-dd HH:mm:ss}";
        var logPath = "Logs/vetoProblems.log";
        Directory.CreateDirectory("Logs");
        File.WriteAllText(logPath, "");

        // Use Spectre.Console's Progress UI to provide a rich, real-time view of the tagging process.
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
                // Create progress task for AI processing phase.
                var processingTask = context.AddTask("[green]Processing problems for AI tagging[/]", maxValue: problemsToVeto.Count);
                processingTask.StartTask();

                await Parallel.ForAsync(0, problemsToVeto.Count, new ParallelOptions { MaxDegreeOfParallelism = settings.NumThreads },
                    async (i, cancellationToken) =>
                {
                    // Get the problem
                    var problem = problemsToVeto[i];

                    // Update progress description to show current problem context.
                    processingTask.Description = $"[green]{i + 1:N0} of {problemsToVeto.Count:N0}[/] [dim]({problem.Slug.ToUpperInvariant()})[/]";

                    var approvalsStatementTask = FilterTags(
                        datetimeString,
                        "statement",
                        geminiOptions.Get("VetoProblemStatementTags"),
                        settings,
                        (tag, data) => tagSelector(tag, data) && data.TagType != TagType.Technique,
                        problem);
                    var approvalsSolutionTask = FilterTags(
                        datetimeString,
                        "solution",
                        geminiOptions.Get("VetoProblemSolutionTags"),
                        settings,
                        (tag, data) => tagSelector(tag, data) && data.TagType == TagType.Technique,
                        problem);

                    var approvals = (await approvalsStatementTask).Union(await approvalsSolutionTask).ToImmutableDictionary();

                    // If we have any tags to apply, we do so here.
                    if (approvals.Count > 0 && !settings.DryRun)
                        await databaseService.VetoTagsForProblemAsync(problem.Id, approvals);

                    var rejectedTags = approvals.Where(kv => !kv.Value).Select(kv => kv.Key).ToJoinedString(", ");
                    var approvedTags = approvals.Where(kv => kv.Value).Select(kv => kv.Key).ToJoinedString(", ");
                    File.AppendAllText(logPath, $"{problem.Slug}: approved {approvedTags}; rejected {rejectedTags}\n");

                    // Advance the progress bar to reflect that this problem has been successfully processed.
                    processingTask.Increment(1);
                });

                // Mark AI processing phase as complete.
                processingTask.StopTask();
            });

        #endregion

        #region Apply changes or report dry-run results

        // In dry-run mode, show what would happen without making database changes.
        if (settings.DryRun)
        {
            // Display summary of intended changes for user review.
            AnsiConsole.MarkupLine($"[bold yellow]Dry run complete.[/]");

            // We're done
            return 0;
        }


        // Confirm successful completion with summary statistics.
        AnsiConsole.MarkupLine($"[bold green]Database updated successfully.[/]");

        #endregion

        return 0;
    }
}

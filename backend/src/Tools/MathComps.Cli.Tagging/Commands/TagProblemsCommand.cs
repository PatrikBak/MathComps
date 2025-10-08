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
/// Orchestrates AI-powered problem tagging using Gemini API with categorized approved tag vocabulary.
/// Processes problems in batches, validates JSON tag suggestions against approved list, and updates database.
/// Supports dry-run mode for safe testing and provides detailed progress tracking with tag categorization.
/// </summary>
/// <param name="databaseService">The database service for accessing problem and tag data.</param>
/// <param name="geminiOptions">Configuration settings specific to the Gemini model for this command.</param>
/// <param name="geminiService">The service responsible for making calls to the Gemini API.</param>
[Description("""
    Automatically tag problems using AI analysis with categorized approved tag vocabulary.
    Stores logs in the 'Logs' folder; these can be used to inspect the process in detail.
    Reasoning behind tags derived from the problem statement can be found in '<problem>.statement.json'
    files; for tags derived using problem solution too (i.e. technique tags), see '<problem>.solution.json'.
    Prompts sent to the LLM are stored in '<problem>.statement.prompt.txt' / '<problem>.solution.prompt.txt'.
""")]
public class TagProblemsCommand(
    ITaggingDatabaseService databaseService,
    IOptionsSnapshot<CommandGeminiSettings> geminiOptions,
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
        [DefaultValue(false)]
        public bool DryRun { get; set; }

        /// <summary>
        /// Batch size limit to control AI API costs and processing time.
        /// </summary>
        [CommandOption("-n|--count")]
        [Description("Number of problems to tag.")]
        public required int Count { get; set; }

        /// <summary>
        /// Whether to exclude problems that already have tags assigned.
        /// This allows efficient processing of only untagged problems, avoiding redundant AI calls.
        /// </summary>
        [CommandOption("--skip-tagged")]
        [Description("Skip problems that already have tags assigned.")]
        [DefaultValue(false)]
        public bool SkipTagged { get; set; }

        /// <summary>
        /// If set, clears all tags of all problems. If specified together with a tag selection,
        /// clears only the tags from the tag selection.
        /// </summary>
        [CommandOption("--clear-tags")]
        [Description("Clears all tags before tagging. If specified together with a tag selection, clears only those tags.")]
        [DefaultValue(false)]
        public bool ClearTags { get; set; }

        /// <summary>
        /// Whether to exclude problems that already have tags assigned.
        /// This allows efficient processing of only untagged problems, avoiding redundant AI calls.
        /// </summary>
        [CommandOption("--num-threads")]
        [Description("Number of threads to run the tagging in parallel. Note: make sure to take into account model rate limits when setting this.")]
        [DefaultValue(1)]
        public int NumThreads { get; set; }

        /// <summary>
        /// Number of threads to run the tagging in parallel.
        /// </summary>
        [CommandOption("--tag-selection-file")]
        [Description("Consider only some subset of tags. Argument should be path to a file, where each line contains the name of one tag.")]
        [DefaultValue(null)]
        public string? TagSelectionFile { get; set; }
    }

    private async Task<ImmutableDictionary<string, ProblemTagData>> TagProblem(
        string folder,
        string suffix,
        CommandGeminiSettings geminiSettings,
        Func<string, (TagType TagType, string Description), bool> tagSelector,
        ProblemDetailsDto problem)
    {
        var systemPromptTemplate = await File.ReadAllTextAsync(geminiSettings.SystemPromptPath);

        var allApprovedTags = TagFilesHelper.GetCategorizedApprovedTags().ToDict();
        var forbiddenTags = allApprovedTags.Where(kv => problem.TagsData.ContainsKey(kv.Key) || !tagSelector(kv.Key, kv.Value))
                .Select(kv => kv.Key).ToImmutableHashSet();

        var tagsToProcess = TagFilesHelper.GetCategorizedApprovedTags().ToDict()
            .Where(kv => !forbiddenTags.Contains(kv.Key))
            .ToImmutableDictionary(kv => kv.Key, kv => new { category = kv.Value.Type.ToString(), description = kv.Value.Description });

        var alreadyAssignedTags = problem.ApprovedTags()
            .Join(allApprovedTags, kv => kv.Key, kv => kv.Key, (fkv, approvedKv) => KeyValuePair.Create(
                fkv.Key, (fkv.Value.TagType, approvedKv.Value.Description)
            ))
            .ToImmutableDictionary(kv => kv.Key, kv => new { category = kv.Value.TagType.ToString(), description = kv.Value.Description });

        if (tagsToProcess.Count == 0)
        {
            return new Dictionary<string, ProblemTagData>().ToImmutableDictionary();
        }

        var jsonSerOptions = new JsonSerializerOptions
        {
            Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping
        };

        var alreadyAssignedTagsText = "";
        if (alreadyAssignedTags.Count > 0)
        {
            alreadyAssignedTagsText = $"""
                The following tags have already been assigned to the problem (you can't unassign them,
                but they may influence your decisions):
                {JsonSerializer.Serialize(alreadyAssignedTags, jsonSerOptions)}
                """;
        }

        var userPrompt = systemPromptTemplate
            .Replace("{already_assigned_tags_text}", alreadyAssignedTagsText)
            .Replace("{candidate_tags}", JsonSerializer.Serialize(tagsToProcess, jsonSerOptions))
            .Replace("{problem_statement}", problem.Statement)
            .Replace("{problem_solution}", problem.Solution ?? string.Empty);

        var userPromptPath = $"Logs/{folder}/{problem.Slug}.{suffix}.prompt.txt";
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
            return new Dictionary<string, ProblemTagData>().ToImmutableDictionary();
        }

        var aiResponsePath = $"Logs/{folder}/{problem.Slug}.{suffix}.json";
        Directory.CreateDirectory(Path.GetDirectoryName(aiResponsePath)!);
        File.WriteAllText(aiResponsePath, aiResponseRaw);

        // Parse the response
        var suggestedTags = GeneralUtilities.TryExecute(() => TaggingHelpers.ParseTagFitnesses(aiResponseRaw)
            .Join(allApprovedTags, kv => kv.Key, kv => kv.Key,
                (suggestedKv, approvedKv) => KeyValuePair.Create(suggestedKv.Key, new ProblemTagData(
                    approvedKv.Value.Type, suggestedKv.Value.GoodnessOfFit, suggestedKv.Value.Justification, 0)))
            .ToImmutableDictionary(),
            // Handle exceptions
            exception =>
            {
                // Log the problem
                AnsiConsole.MarkupLine($"[red]{problem.Slug.ToUpperInvariant()}[/] AI response parsing problem");
                AnsiConsole.WriteException(exception);
            });

        if (suggestedTags is null)
        {
            return new Dictionary<string, ProblemTagData>().ToImmutableDictionary();
        }

        suggestedTags = suggestedTags.Where(kv => tagsToProcess.ContainsKey(kv.Key)).ToImmutableDictionary();
        return suggestedTags;
    }

    /// <inheritdoc/>
    public override async Task<int> ExecuteAsync(CommandContext context, Settings settings)
    {
        if (settings.SkipTagged && settings.ClearTags)
        {
            throw new Exception("Both '--skip-tagged' and '--clear-tags' have been specified, but they are mutually exclusive.");
        }

        #region Load configuration and initial data

        Func<string, (TagType, string), bool> tagSelector = (tag, data) => true;
        var tagsSelection = TagFilesHelper.GetCategorizedApprovedTags().Simple();
        if (settings.TagSelectionFile != null)
        {
            var tags = File.ReadAllLines(settings.TagSelectionFile);
            ImmutableHashSet<string> tagsSet = [.. tags];
            tagsSelection = tagsSelection.Filter(tagsSet.ToImmutableDictionary(tag => tag, tag => true), out var tmp1, out var tmp2);
            tagSelector = (tag, data) => tagsSet.Contains(tag);
        }

        if (settings.ClearTags)
        {
            await databaseService.RemoveTagsFromAllProblemsAsync([.. tagsSelection.ToDict().Keys]);
        }

        // Retrieve the problems that need tagging based on user settings.
        var problemsToTag = await databaseService.GetProblemsToTagAsync(
            settings.Count, settings.SkipTagged, tagsSelection);

        // If no problems found to process.
        if (problemsToTag.Count == 0)
        {
            // Make aware
            AnsiConsole.MarkupLine("[yellow]No problems found to tag with the specified criteria.[/]");

            // Nothing to do
            return 0;
        }

        #endregion

        #region Process problems with AI tagging

        var datetimeString = $"{DateTime.Now:yyyy-MM-dd HH:mm:ss}";
        var logPath = "Logs/tagProblems.log";
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
                var processingTask = context.AddTask("[green]Processing problems for AI tagging[/]", maxValue: problemsToTag.Count);
                processingTask.StartTask();

                SemaphoreSlim semaphore = new(1, 1);

                await Parallel.ForAsync(0, problemsToTag.Count, new ParallelOptions { MaxDegreeOfParallelism = settings.NumThreads },
                    async (i, cancellationToken) =>
                {
                    // Get the problem
                    var problem = problemsToTag[i];

                    // Update progress description to show current problem context.
                    processingTask.Description = $"[green]{i + 1:N0} of {problemsToTag.Count:N0}[/] [dim]({problem.Slug.ToUpperInvariant()})[/]";

                    var statementTagsAsync = TagProblem(
                        datetimeString,
                        "statement",
                        geminiOptions.Get("TagProblemStatement"),
                        (tag, data) => data.TagType != TagType.Technique && tagSelector(tag, data),
                        problem);
                    var techniqueTagsAsync = Task.FromResult(new Dictionary<string, ProblemTagData>().ToImmutableDictionary());
                    if (problem.Solution != null)
                    {
                        techniqueTagsAsync = TagProblem(
                            datetimeString,
                            "solution",
                            geminiOptions.Get("TagProblemSolution"),
                            (tag, data) => data.TagType == TagType.Technique && tagSelector(tag, data),
                            problem);
                    }

                    var statementTags = await statementTagsAsync;
                    var techniqueTags = await techniqueTagsAsync;
                    var suggestedTags = statementTags.Union(techniqueTags).ToImmutableDictionary();

                    // If we have any tags to apply, we do so here.
                    if (suggestedTags.Count > 0 && !settings.DryRun)
                    {
                        await semaphore.WaitAsync(cancellationToken);
                        try
                        {
                            await databaseService.AddTagsForProblemAsync(problem.Id, suggestedTags);
                        }
                        finally
                        {
                            semaphore.Release();
                        }
                    }

                    var tags = suggestedTags.Where(kv => kv.Value.GoodnessOfFit >= 0.5f).Select(kv => kv.Key).ToJoinedString(", ");
                    File.AppendAllText(logPath, $"{problem.Slug}: {tags}\n");

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

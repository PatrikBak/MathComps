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
/// Orchestrates AI-powered problem tagging using Gemini API with categorized approved tag vocabulary.
/// Processes problems in batches, validates JSON tag suggestions against approved list, and updates database.
/// Supports dry-run mode for safe testing and provides detailed progress tracking with tag categorization.
/// </summary>
/// <param name="databaseService">The database service for accessing problem and tag data.</param>
/// <param name="geminiOptions">Configuration settings specific to the Gemini model for this command.</param>
/// <param name="geminiService">The service responsible for making calls to the Gemini API.</param>
[Description("Automatically tag problems using AI analysis with categorized approved tag vocabulary.")]
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
    }

    /// <inheritdoc/>
    public override async Task<int> ExecuteAsync(CommandContext context, Settings settings)
    {
        #region Load configuration and initial data

        // Load settings for the command
        var geminiSettings = geminiOptions.Get("TagProblems");

        // Load system prompts
        var systemPromptTemplate = await File.ReadAllTextAsync(geminiSettings.SystemPromptPath);

        // Load categorized approved tags from the version-controlled file for AI context.
        var approvedTags = TagFilesHelper.GetCategorizedApprovedTags();

        // We'll be comparings tags by slugs
        var approvedTagSlugs = approvedTags.ToImmutableDictionary(
            pair => pair.Key,
            pair => pair.Value.Select(tag => tag.ToSlug()).ToImmutableHashSet()
        );

        // Retrieve the problems that need tagging based on user settings.
        var problemsToTag = await databaseService.GetProblemsToTagAsync(settings.Count, settings.SkipTagged);

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

                // Process each problem sequentially to get AI tag suggestions.
                for (var i = 0; i < problemsToTag.Count; i++)
                {
                    // Get the problem
                    var problem = problemsToTag[i];

                    // Update progress description to show current problem context.
                    processingTask.Description = $"[green]{i + 1:N0} of {problemsToTag.Count:N0}[/] [dim]({problem.Slug.ToUpperInvariant()})[/]";

                    // Format the categorized approved tags for the prompt in a structured way.
                    var approvedTagsText = string.Join("\n",
                    [
                        "AREA TAGS:",
                        approvedTags[TagType.Area].Select(tagWithType => "- " + tagWithType).ToJoinedString(),
                        "",
                        "TYPE TAGS:",
                        approvedTags[TagType.Type].Select(tagWithType => "- " + tagWithType).ToJoinedString(),
                        "",
                        "TECHNIQUE TAGS:",
                        approvedTags[TagType.Technique].Select(tagWithType => "- " + tagWithType).ToJoinedString(),
                    ]);

                    // Build AI prompt by substituting template placeholders with actual data.
                    var userPrompt = systemPromptTemplate
                        .Replace("{approved_tags}", approvedTagsText)
                        .Replace("{problem_statement}", problem.Statement)
                        .Replace("{problem_solution}", problem.Solution ?? string.Empty);

                    // Request AI tag suggestions using the configured model and prompt.
                    var aiResponseRaw = await GeneralUtilities.TryExecuteAsync(() => geminiService.GenerateContentAsync(geminiSettings.Model, systemPromptTemplate, userPrompt),
                        // Handle errors
                        exception =>
                        {
                            // Log the problem
                            AnsiConsole.MarkupLine($"[red]{problem.Slug.ToUpperInvariant()}[/] Gemini service errors");
                            AnsiConsole.WriteException(exception);
                        });

                    // Sad problems
                    if (aiResponseRaw is null)
                    {
                        // Progress further
                        processingTask.Increment(1);

                        // Move onto the next problem
                        continue;
                    }

                    // Parse the response
                    var suggestedTags = GeneralUtilities.TryExecute(() => TaggingHelpers.ParseAiResponse(aiResponseRaw),
                        // Handle exceptions
                        exception =>
                        {
                            // Log the problem
                            AnsiConsole.MarkupLine($"[red]{problem.Slug.ToUpperInvariant()}[/] AI response parsing problem");
                            AnsiConsole.WriteException(exception);
                        });

                    // Sad problems
                    if (suggestedTags is null)
                    {
                        // Progress further
                        processingTask.Increment(1);

                        // Move onto the next problem
                        continue;
                    }
                    // The raw response from the AI is immediately filtered against the master list of approved tag names.
                    // This is a critical security and data integrity step to ensure that only sanctioned tags can ever enter the database.
                    var filteredResponse = FilterToApprovedTagsOnly(suggestedTags, approvedTagSlugs);

                    // If we have any tags to apply, we do so here.
                    if (filteredResponse.GetAllTags().Count > 0 && !settings.DryRun)
                        await databaseService.UpdateTagsForProblemAsync(problem.Id, filteredResponse);

                    // Advance the progress bar to reflect that this problem has been successfully processed.
                    processingTask.Increment(1);
                }

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


    /// <summary>
    /// Filters AI tagging response to keep only tags that exist in the approved tags list.
    /// This ensures database consistency by rejecting any invalid or non-approved tag suggestions.
    /// </summary>
    /// <param name="response">The original AI tagging response.</param>
    /// <param name="approvedTagSlugs">The slugs of tags (lol) that are approved.</param>
    /// <returns>Filtered response containing only valid approved tags.</returns>
    private static TagCollection FilterToApprovedTagsOnly(
        TagCollection response,
        ImmutableDictionary<TagType, ImmutableHashSet<string>> approvedTagSlugs)
    {
        // Area tags
        var validArea = response.Area?
            .Where(tagName => approvedTagSlugs[TagType.Area].Contains(tagName.ToSlug()))
            .ToArray();

        // Type tags
        var validType = response.Type?
            .Where(tagName => approvedTagSlugs[TagType.Type].Contains(tagName.ToSlug()))
            .ToArray();

        // Technique tags
        var validTechnique = response.Technique?
            .Where(tagName => approvedTagSlugs[TagType.Technique].Contains(tagName.ToSlug()))
            .ToArray();

        // We're happy
        return new TagCollection(
            Area: validArea?.Length > 0 ? validArea : null,
            Type: validType?.Length > 0 ? validType : null,
            Technique: validTechnique?.Length > 0 ? validTechnique : null);
    }
}

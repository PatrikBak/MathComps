using MathComps.Cli.Tagging.Commands.Helpers;
using MathComps.Cli.Tagging.Dtos;
using MathComps.Cli.Tagging.Services;
using MathComps.Cli.Tagging.Settings;
using MathComps.Shared;
using Microsoft.Extensions.Options;
using Spectre.Console;
using Spectre.Console.Cli;
using System.Collections.Immutable;
using System.ComponentModel;
using static MathComps.Cli.Tagging.Constants.LoggingConstants;

namespace MathComps.Cli.Tagging.Commands;

/// <summary>
/// Handles loading problems with solutions, then sending them to Gemini for categorized tag suggestions,
/// then sending the suggested tags back to Gemini for filtering, then storing the final suggestions.
/// </summary>
/// <param name="databaseService">The database service for accessing problem and tag data.</param>
/// <param name="suggestTagsOptions">The settings for the command which don't need to be in options.</param>
/// <param name="geminiService">The service responsible for making calls to the Gemini API.</param>
[Description(
   $"""
    Suggests categorized tags (Area/Goal/Type/Technique) based on a random sample of problems with solutions.
    Stores logs in the '{LogsDirectory}' folder:
      - {SuggestTagsLogFile} is the prompt for suggesting tags
      - {SuggestTagsAiResponseFile} is the AI response
      - {FilterTagsPromptFile} is the prompt for vetoing suggested tags
      - {FilterTagsAiResponseFile} is the AI response to vetoing
    """)]
public class SuggestTagsCommand(
    ITaggingDatabaseService databaseService,
    IOptions<SuggestTagsSettings> suggestTagsOptions,
    IGeminiService geminiService)
    : AsyncCommand<SuggestTagsCommand.Settings>
{
    /// <summary>
    /// Configuration settings for the suggest-tags command.
    /// </summary>
    public class Settings : CommandSettings
    {
        /// <summary>
        /// How many problems we sent, usually ~50 already takes too long. Who knows whether
        /// this will even be more useful now, given that the approved tags are already okay.
        /// </summary>
        [CommandOption("-n|--count")]
        [Description("Number of random problems with solutions to use for categorized tag suggestions.")]
        public required int Count { get; set; }
    }

    /// <inheritdoc/>
    public override async Task<int> ExecuteAsync(CommandContext context, Settings settings)
    {
        // Ensure the logs directory exists
        Directory.CreateDirectory(LogsDirectory);

        // Get random problems with solutions for tag discovery.
        var problemsWithSolutions = await databaseService.GetProblemsForTagSuggestionAsync(settings.Count);

        // 1st round of AI: suggest tags
        var (suggestedTags, aiResponse1) = await SuggestTags(problemsWithSolutions);

        // 2nd round of AI: filter tags
        (suggestedTags, var aiResponse2) = await FilterTags(suggestedTags);

        // The final AI response text to log
        var aiResponse =
            "Suggested tags:\n"
            .Concat(aiResponse1)
            .Concat("\n\nFiltering output:\n")
            .Concat(aiResponse2)
            .Concat("\n")
            .ToJoinedString("");

        // Remove any suggestions that it should have not made but AI is shit so...
        suggestedTags = suggestedTags.FilterOut(
            // Remove forbidden + 
            TagFilesHelper.GetForbiddenTags().GetAllTagNames()
                // Approved tags
                .Concat(TagFilesHelper.GetCategorizedApprovedTags().MapTagsToTheirData().Keys
            ));

        // Find the counts, just for logging
        var countPerTag = suggestedTags.Data.ToImmutableDictionary(pair => pair.Key, pair => pair.Value.Length);
        var totalCount = countPerTag.Sum(pair => pair.Value);
        var countsText = countPerTag.Select(pair => $"{pair.Key}: {pair.Value}").ToJoinedString();

        // Yay, we have a summary
        var tagSummary = $"{totalCount} new tags suggested ({countsText})";

        // Write the approved suggested tags to a simple JSON file
        File.WriteAllText($"{LogsDirectory}/{SuggestedTagsJsonFile}", suggestedTags.ToJson(writeIndented: true));

        // Log completion with summary of suggestions.
        AnsiConsole.MarkupLine($"[green]Tag suggestion finished:[/] {tagSummary}");

        // Happy
        return 0;
    }

    /// <summary>
    /// Sends problems to the AI service to generate initial tag suggestions.
    /// Creates a prompt with the problems, tag rules, and approved tags, then calls the Gemini API.
    /// </summary>
    /// <param name="problemsWithSolutions">The list of problems with their solutions to analyze for tag suggestions.</param>
    /// <returns>A tuple containing the parsed suggested tags and the raw AI response for logging purposes.</returns>
    private async Task<(SimpleTagsByCategory Tags, string RawAiResponse)> SuggestTags(List<ProblemDetailsDto> problemsWithSolutions)
    {
        // Log start
        AnsiConsole.MarkupLine($"[blue]Suggesting tags[/]");

        // Get the Gemini settings for the prompt
        var geminiSettings = suggestTagsOptions.Value.SuggestTags;

        // Get the system prompt for suggesting tags
        var systemPrompt = File.ReadAllText(geminiSettings.SystemPromptPath);

        // Get the tag rules text (common for both suggesting and filtering)
        var tagRules = File.ReadAllText(suggestTagsOptions.Value.TagRulesPath);

        // Get the approved tags from which the AI should choose
        var approvedTags = TagFilesHelper.GetCategorizedApprovedTags();

        // Format problem + solution for the prompt.
        var problemsText = problemsWithSolutions
            .Select(problem => $"Problem: {problem.Statement}\nSolution: {problem.Solution}")
            .ToJoinedString("\n---\n");

        // Build the final prompt by replacing placeholders with actual data.
        var userPrompt = systemPrompt
            .Replace("{tag_rules}", tagRules)
            .Replace("{example_tags}", approvedTags.ToJson())
            .Replace("{problems}", problemsText);

        // Store the prompt for debugging
        File.WriteAllText($"{LogsDirectory}/{SuggestTagsLogFile}", userPrompt);

        // Call the AI
        var aiResponseRaw = await geminiService.GenerateContentAsync(
            geminiSettings.Model,
            systemPrompt,
            userPrompt,
            geminiSettings.ThinkingBudget
        );

        // Store the AI response for debugging
        File.WriteAllText($"{LogsDirectory}/{SuggestTagsAiResponseFile}", aiResponseRaw);

        // Parse and return the suggested tags along with the raw AI response.
        return (TaggingHelpers.ParseSuggestedTags(aiResponseRaw), aiResponseRaw);
    }

    /// <summary>
    /// Sends the initially suggested tags back to the AI for filtering and approval.
    /// The AI reviews each suggested tag against existing approved and forbidden tags to make approval decisions.
    /// </summary>
    /// <param name="candidateTags">The initially suggested tags that need to be filtered and approved.</param>
    /// <returns>A tuple containing the filtered approved tags and the raw AI response for logging purposes.</returns>
    private async Task<(SimpleTagsByCategory Tags, string RawAiResponse)> FilterTags(SimpleTagsByCategory candidateTags)
    {
        // Log start
        AnsiConsole.MarkupLine($"[blue]Filtering suggested tags[/]");

        // Get the Gemini settings for filtering
        var geminiSettings = suggestTagsOptions.Value.VetoTags;

        // Get the system prompt for filtering
        var systemPrompt = File.ReadAllText(geminiSettings.SystemPromptPath);

        // Get the tag rules text (common for both suggesting and filtering)
        var tagRules = File.ReadAllText(suggestTagsOptions.Value.TagRulesPath);

        // Get the approved tags from which the AI should choose
        var approvedTags = TagFilesHelper.GetCategorizedApprovedTags();

        // Get the forbidden tags to help AI with the filtering (hopefully)
        var forbiddenTags = TagFilesHelper.GetForbiddenTags();

        // Build the final prompt by replacing placeholders with actual data.
        var userPrompt = systemPrompt
            .Replace("{tag_rules}", tagRules)
            .Replace("{candidate_tags}", candidateTags.ToJson())
            .Replace("{known_tags}", approvedTags.ToJson())
            .Replace("{forbidden_tags}", forbiddenTags.ToJson());

        // Store the filter prompt for debugging
        File.WriteAllText($"{LogsDirectory}/{FilterTagsPromptFile}", userPrompt);

        // Call the AI
        var aiResponseRaw = await geminiService.GenerateContentAsync(
            geminiSettings.Model,
            systemPrompt,
            userPrompt,
            geminiSettings.ThinkingBudget
        );

        // Store the AI response for debugging 
        File.WriteAllText($"{LogsDirectory}/{FilterTagsAiResponseFile}", aiResponseRaw);

        // Get a dictionary mapping... tag names to approval decisions
        var approvals = TaggingHelpers.ParseTagApprovals(aiResponseRaw)
            .ToImmutableDictionary(pair => pair.Key, pair => pair.Value.Approved);

        // Apply the approvals to the candidate tags
        var result = candidateTags.Filter(approvals, out var unmatchedApprovals, out var unmatchedCandidates);

        // Warn about any unmatched tags, I guess this won't happen?
        if (unmatchedApprovals.Count > 0)
            AnsiConsole.MarkupLine($"[yellow]AI suggested filter out nonexistent tags:[/] {unmatchedApprovals.Order().ToJoinedString()}");

        // Done
        return (result, aiResponseRaw);
    }
}

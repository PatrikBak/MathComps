using MathComps.Cli.Tagging.Dtos;
using MathComps.Cli.Tagging.Services;
using MathComps.Cli.Tagging.Settings;
using MathComps.Shared;
using Microsoft.Extensions.Options;
using Spectre.Console;
using Spectre.Console.Cli;
using System.Collections.Immutable;
using System.ComponentModel;

namespace MathComps.Cli.Tagging.Commands;

/// <summary>
/// Handles loading problems with solutions, then sending them to Gemini for categorized tag suggestions,
/// then writing the AI's JSON response to a debug file for human review and approval.
/// The prompt includes a single flattened DISALLOWED list (approved + forbidden) to block duplicates and low‑value entries
/// while leaving room for creative but high‑quality, generally useful suggestions.
/// </summary>
/// <param name="databaseService">The database service for accessing problem and tag data.</param>
/// <param name="geminiOptions">Configuration settings specific to the Gemini model for this command.</param>
/// <param name="geminiService">The service responsible for making calls to the Gemini API.</param>
[Description("Suggests categorized tags (Area/Type/Technique) based on a random sample of problems with solutions.")]
public class SuggestTagsCommand(
    ITaggingDatabaseService databaseService,
    IOptionsSnapshot<CommandGeminiSettings> geminiOptions,
    IGeminiService geminiService)
    : AsyncCommand<SuggestTagsCommand.Settings>
{
    /// <summary>
    /// The command arguments
    /// </summary>
    public class Settings : CommandSettings
    {
        [CommandOption("-n|--count")]
        [Description("Number of random problems with solutions to use for categorized tag suggestions.")]
        public required int Count { get; set; }
    }

    ///// <inheritdoc/>
    public override async Task<int> ExecuteAsync(CommandContext context, Settings settings)
    {
        // Get the gemini settings
        var geminiSettings = geminiOptions.Get("SuggestTags");

        // Load the system prompt template for this command.
        var systemPrompt = await File.ReadAllTextAsync(geminiSettings.SystemPromptPath);

        // Read the categorized approved tags and forbidden tags for AI context and filtering.
        // We will provide the AI with a single flattened DISALLOWED list (approved + forbidden).
        var approvedTags = TagFilesHelper.GetCategorizedApprovedTags();

        // Merge all tag names the AI should not suggest (approved + forbidden),
        // ordered nicely (who knows, maybe it has an affect)
        var disallowedTagNames = approvedTags.Values.Flatten()
            .Concat(TagFilesHelper.GetForbiddenTags())
            .Order()
            .ToImmutableList();

        // We'll be comparing tags by slugs (I love this)
        var disallowedTagSlugs = disallowedTagNames.Select(tag => tag.ToSlug()).ToImmutableHashSet();

        // Get random problems with solutions for tag discovery.
        var problemsWithSolutions = await databaseService.GetProblemsForTagSuggestionAsync(settings.Count);

        // Format problems for the prompt.
        var problemsText = problemsWithSolutions
            .Select(problem => $"Problem: {problem.Statement}\nSolution: {problem.Solution}")
            .ToJoinedString("\n---\n");

        // Build the user prompt by injecting the DISALLOWED list and problems into the template.
        var userPrompt = systemPrompt
            .Replace("{disallowed_tags}", disallowedTagNames.ToJoinedString("\n"))
            .Replace("{problems}", problemsText);

        // Call the AI service to get the categorized tag suggestions in JSON format.
        var aiResponseRaw = await geminiService.GenerateContentAsync(geminiSettings.Model, systemPrompt, userPrompt);

        // Parse the response
        var suggestedTags = GeneralUtilities.TryExecute(() => TaggingHelpers.ParseAiResponse(aiResponseRaw));

        // Time to parse out the shit it returned
        string tagSummary;

        // Some shit
        if (suggestedTags is null)
            tagSummary = "AI returned non-JSON response";

        // Some tags
        else
        {
            // Remove any suggestions that it should have not made but AI is shit so...
            suggestedTags = FilterOutApprovedOrForbiddenTags(suggestedTags, disallowedTagSlugs);

            // Find the counts, just for logging
            var areaCount = suggestedTags.Area?.Length ?? 0;
            var typeCount = suggestedTags.Type?.Length ?? 0;
            var techniqueCount = suggestedTags.Technique?.Length ?? 0;
            var totalCount = areaCount + typeCount + techniqueCount;

            // Yay, we have a summary
            tagSummary = $"{totalCount} new tags suggested (Area: {areaCount}, Type: {typeCount}, Technique: {techniqueCount})";
        }

        // Make sure the suggested tags are logged
        TagFilesHelper.WriteSuggestedTags(
            aiResponseRaw,
            suggestedTags,
            problems: [.. problemsWithSolutions.Select(problem => problem.Slug).Order()]);

        // Log completion with summary of suggestions.
        AnsiConsole.MarkupLine($"[green]Tag suggestion finished:[/] {tagSummary}");

        // Happy
        return 0;
    }

    /// <summary>
    /// Filters out any AI suggestions that already exist in the approved tags list.
    /// This ensures no duplicate tags are suggested regardless of AI compliance with instructions.
    /// </summary>
    /// <param name="suggestion">The original AI suggestion response.</param>
    /// <param name="disallowedTagSlugs">Set of all disallowed tag slugs (hehe) for deduplication.</param>
    /// <returns>Filtered suggestion with duplicates removed.</returns>
    private static TagCollection FilterOutApprovedOrForbiddenTags(
        TagCollection suggestion,
        ImmutableHashSet<string> disallowedTagSlugs)
    {
        // Area tags
        var filteredArea = suggestion.Area?
            .Where(tagName => !disallowedTagSlugs.Contains(tagName.ToSlug()))
            .ToArray();

        // Type tags
        var filteredType = suggestion.Type?
            .Where(tagName => !disallowedTagSlugs.Contains(tagName.ToSlug()))
            .ToArray();

        // Technique tags
        var filteredTechnique = suggestion.Technique?
            .Where(tagName => !disallowedTagSlugs.Contains(tagName.ToSlug()))
            .ToArray();

        // We're happy
        return new TagCollection(
            Area: filteredArea?.Length > 0 ? filteredArea : null,
            Type: filteredType?.Length > 0 ? filteredType : null,
            Technique: filteredTechnique?.Length > 0 ? filteredTechnique : null);
    }
}

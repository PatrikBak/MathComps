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
using System.Diagnostics;
using System.Text.Encodings.Web;
using System.Text.Json;

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
[Description("""
    Suggests categorized tags (Area/Goal/Type/Technique) based on a random sample of problems with solutions.
    Stores log in the 'Logs' folder:
    - suggestTagsPrompt.txt is the prompt for suggesting tags
    - suggestTags.aiResponse.json is the AI response
    - filterTagsPrompt.txt is the prompt for vetoing suggested tags
    - filterTags.aiResponse.json is the AI response to vetoing
""")]
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

    private static string GetTagRules()
    {
        return File.ReadAllText("Prompts/tag-rules.txt");
    }

    private async Task<(SimpleTagsByCategory, string)> SuggestTags(List<ProblemDetailsDto> problemsWithSolutions)
    {
        // Get the gemini settings
        var geminiSettings = geminiOptions.Get("SuggestTags");

        // Load the system prompt template for this command.
        var systemPrompt = await File.ReadAllTextAsync(geminiSettings.SystemPromptPath);
        var tagRules = GetTagRules();
        var exampleTags = TagFilesHelper.GetCategorizedApprovedTags();

        // Format problems for the prompt.
        var problemsText = problemsWithSolutions
            .Select(problem => $"Problem: {problem.Statement}\nSolution: {problem.Solution}")
            .ToJoinedString("\n---\n");

        // Build the user prompt by injecting the DISALLOWED list and problems into the template.
        var userPrompt = systemPrompt
            .Replace("{tag_rules}", tagRules)
            .Replace("{example_tags}", exampleTags.ToJson())
            .Replace("{problems}", problemsText);

        Directory.CreateDirectory("Logs");
        File.WriteAllText("Logs/suggestTagsPrompt.txt", userPrompt);

        // Call the AI service to get the categorized tag suggestions in JSON format.
        var aiResponseRaw = await geminiService.GenerateContentAsync(geminiSettings.Model, systemPrompt, userPrompt, geminiSettings.ThinkingBudget);
        File.WriteAllText("Logs/suggestTags.aiResponse.json", aiResponseRaw);

        return (TaggingHelpers.ParseSuggestedTags(aiResponseRaw), aiResponseRaw);
    }

    private async Task<(SimpleTagsByCategory, string)> FilterTags(SimpleTagsByCategory candidateTags)
    {
        var geminiSettings = geminiOptions.Get("VetoTags");

        var systemPrompt = await File.ReadAllTextAsync(geminiSettings.SystemPromptPath);
        var tagRules = GetTagRules();
        var knownTags = TagFilesHelper.GetCategorizedApprovedTags();
        var forbiddenTags = TagFilesHelper.GetForbiddenTags();

        var userPrompt = systemPrompt
            .Replace("{tag_rules}", tagRules)
            .Replace("{candidate_tags}", candidateTags.ToJson())
            .Replace("{known_tags}", knownTags.ToJson())
            .Replace("{forbidden_tags}", JsonSerializer.Serialize(forbiddenTags, new JsonSerializerOptions
            {
                Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping
            }));

        Directory.CreateDirectory("Logs");
        File.WriteAllText("Logs/filterTagsPrompt.txt", userPrompt);

        var aiResponseRaw = await geminiService.GenerateContentAsync(geminiSettings.Model, systemPrompt, userPrompt, geminiSettings.ThinkingBudget);
        File.WriteAllText("Logs/filterTags.aiResponse.json", aiResponseRaw);

        var approvals = TaggingHelpers.ParseTagApprovals(aiResponseRaw)
            .ToImmutableDictionary(kv => kv.Key, kv => kv.Value.Approved);
        var result = candidateTags.Filter(approvals, out var unmatchedApprovals, out var unmatchedCandidates);
        if (unmatchedApprovals.Count > 0)
        {
            var text = unmatchedApprovals.ToList().ToJoinedString(",");
            AnsiConsole.MarkupLine($"[yellow]Tag filtering tried to filter some nonexistent tags:[/] {text}");
        }
        if (unmatchedCandidates.Count > 0)
        {
            var text = unmatchedCandidates.ToList().ToJoinedString(", ");
            AnsiConsole.MarkupLine($"[yellow]Tag filtering did not filter an existing tag (will be omitted by default):[/] {text}");
        }

        return (result, aiResponseRaw);
    }

    ///// <inheritdoc/>
    public override async Task<int> ExecuteAsync(CommandContext context, Settings settings)
    {
        // Get random problems with solutions for tag discovery.
        var problemsWithSolutions = await databaseService.GetProblemsForTagSuggestionAsync(settings.Count);

        var (suggestedTags, aiResponse) = await SuggestTags(problemsWithSolutions);
        if (suggestedTags != null)
        {
            (suggestedTags, var aiResponse2) = await FilterTags(suggestedTags);
            aiResponse = "Suggested tags:\n".Concat(aiResponse).Concat("\n\nFiltering output:\n").Concat(aiResponse2).Concat("\n").ToJoinedString("");
        }

        if (suggestedTags != null)
        {
            // Remove any suggestions that it should have not made but AI is shit so...
            var disallowedTagSlugs = TagFilesHelper.GetForbiddenTags().Keys
                .Concat(TagFilesHelper.GetCategorizedApprovedTags().ToDict().Keys)
                .Select(tag => tag.ToSlug()).ToImmutableHashSet();
            suggestedTags = FilterOutApprovedOrForbiddenTags(suggestedTags, disallowedTagSlugs);
        }

        Trace.Assert(suggestedTags != null, "impossible");
        Trace.Assert(aiResponse != null, "impossible");

        // Find the counts, just for logging
        var counts = suggestedTags.Data.ToImmutableDictionary(kv => kv.Key, kv => kv.Value.Length);
        var totalCount = counts.Select(kv => kv.Value).Aggregate(0, (a, b) => a + b);
        var countsText = string.Join(", ", counts.Select(kv => $"{kv.Key}: {kv.Value}"));

        // Yay, we have a summary
        var tagSummary = $"{totalCount} new tags suggested ({countsText})";

        // Make sure the suggested tags are logged
        TagFilesHelper.WriteTags(
            aiResponse,
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
    private static SimpleTagsByCategory FilterOutApprovedOrForbiddenTags(
        SimpleTagsByCategory suggestion,
        ImmutableHashSet<string> disallowedTagSlugs)
    {
        var filtered = suggestion.Data.ToImmutableDictionary(kv => kv.Key,
            kv => kv.Value.Where(tag => !disallowedTagSlugs.Contains(tag.ToSlug())).ToArray());
        return new SimpleTagsByCategory(filtered);
    }
}

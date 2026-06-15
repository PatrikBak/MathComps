using MathComps.Cli.Tagging.Commands.Helpers;
using MathComps.Cli.Tagging.Dtos;
using MathComps.Infrastructure.Options;
using MathComps.Infrastructure.Services.Integrations;
using MathComps.Shared;
using System.Collections.Immutable;
using MathComps.Domain.Tagging;
using MathComps.Shared.Serialization;

namespace MathComps.Cli.Tagging.Services;

/// <summary>
/// A single tag offered to the AI as a candidate, identified by its AI-language (English) display name — the AI sees
/// and returns names, which we map back to slugs.
/// </summary>
/// <param name="Slug">The canonical slug the name resolves to.</param>
/// <param name="Name">The AI-language display name shown to and returned by the model.</param>
/// <param name="Type">The tag's category.</param>
/// <param name="Description">The vocabulary description that helps the model judge fit.</param>
/// <param name="Justification">The proposed tag's reason — set only for the veto pass, null when generating.</param>
public record AiTagCandidate(string Slug, string Name, TagType Type, string Description, string? Justification = null);

/// <summary>
/// The outcome of one generate pass: the proposed tags keyed by slug, plus any names the model returned that are not
/// in the candidate vocabulary (surfaced for human review, never written into a draft).
/// </summary>
/// <param name="TagsBySlug">Proposed tags with their fitness, keyed by canonical slug.</param>
/// <param name="UnknownNames">Names the model returned that resolve to no approved slug.</param>
public record SuggestTagsResult(
    ImmutableDictionary<string, TagFitness> TagsBySlug,
    ImmutableArray<string> UnknownNames);

/// <summary>
/// Gemini-backed implementation of <see cref="IAiTaggingService"/>: fills the per-pass prompt template, calls
/// <see cref="IGeminiService"/>, and maps the model's name-keyed response back to slugs.
/// </summary>
/// <param name="geminiService">The Gemini API client.</param>
public class AiTaggingService(IGeminiService geminiService) : IAiTaggingService
{
    /// <summary>
    /// The per-candidate payload the generate prompt expects: <c>{ "category": ..., "description": ... }</c>.
    /// </summary>
    /// <param name="Category">The tag's category.</param>
    /// <param name="Description">The vocabulary description.</param>
    private record GenerateCandidatePayload(TagType Category, string Description);

    /// <summary>
    /// The per-candidate payload the veto prompt expects:
    /// <c>{ "tagCategory": ..., "tagDescription": ..., "justification": ... }</c>.
    /// </summary>
    /// <param name="TagCategory">The tag's category.</param>
    /// <param name="TagDescription">The vocabulary description.</param>
    /// <param name="Justification">The generate pass's reason for proposing the tag.</param>
    private record VetoCandidatePayload(TagType TagCategory, string TagDescription, string? Justification);

    /// <inheritdoc/>
    public async Task<SuggestTagsResult> SuggestTagsAsync(
        string statement,
        string? solution,
        IReadOnlyCollection<AiTagCandidate> candidates,
        AiModelConfig config,
        CancellationToken cancellationToken = default)
    {
        // Nothing to ask about — return an empty result without burning a call.
        if (candidates.Count == 0)
            return new SuggestTagsResult([], []);

        // Offer the candidates to the model keyed by name in the shape the generate prompt expects.
        var payload = candidates.ToImmutableDictionary(
            candidate => candidate.Name,
            candidate => new GenerateCandidatePayload(candidate.Type, candidate.Description));

        // Run the call.
        var raw = await CallGeminiAsync(config, statement, solution, payload.ToJson(), cancellationToken);

        // Parse the fitness scores it returns (keyed by name).
        var byName = TaggingHelpers.ParseTagFitnesses(raw);

        // Map the names back to slugs, keeping the few unknowns aside for the human.
        return MapFitnessesToSlugs(byName, candidates);
    }

    /// <inheritdoc/>
    public async Task<ImmutableHashSet<string>> VetoTagsAsync(
        string statement,
        string? solution,
        IReadOnlyCollection<AiTagCandidate> candidates,
        AiModelConfig config,
        CancellationToken cancellationToken = default)
    {
        // Nothing proposed — nothing to veto.
        if (candidates.Count == 0)
            return [];

        // Present the proposed tags with their justifications in the shape the veto prompt expects.
        var payload = candidates.ToImmutableDictionary(
            candidate => candidate.Name,
            candidate => new VetoCandidatePayload(candidate.Type, candidate.Description, candidate.Justification));

        // Run the call.
        var raw = await CallGeminiAsync(config, statement, solution, payload.ToJson(), cancellationToken);

        // Parse the approval decisions it returns (keyed by name).
        var byName = TaggingHelpers.ParseTagApprovals(raw);

        // Keep only the slugs the model approved.
        return MapApprovalsToApprovedSlugs(byName, candidates);
    }

    /// <summary>
    /// Maps a name-keyed fitness response back to slugs, separating out names that match no candidate.
    /// </summary>
    /// <param name="byName">The model's fitness scores keyed by name.</param>
    /// <param name="candidates">The candidates that were offered to the model.</param>
    /// <returns>The proposed tags keyed by slug, plus the unmatched names.</returns>
    private static SuggestTagsResult MapFitnessesToSlugs(
        ImmutableDictionary<string, TagFitness> byName,
        IReadOnlyCollection<AiTagCandidate> candidates)
    {
        // Resolve each offered name to its slug.
        var nameToSlug = candidates.ToImmutableDictionary(candidate => candidate.Name, candidate => candidate.Slug);

        // Names that resolve become slug-keyed results.
        var known = byName
            .Where(pair => nameToSlug.ContainsKey(pair.Key))
            .ToImmutableDictionary(pair => nameToSlug[pair.Key], pair => pair.Value);

        // Names the model invented outside the vocabulary are surfaced, not silently dropped.
        var unknown = byName.Keys
            .Where(name => !nameToSlug.ContainsKey(name))
            .ToImmutableArray();

        // Pair the resolved tags with the unmatched names.
        return new SuggestTagsResult(known, unknown);
    }

    /// <summary>
    /// Reduces a name-keyed approval response to the set of approved slugs.
    /// </summary>
    /// <param name="byName">The model's approval decisions keyed by name.</param>
    /// <param name="candidates">The candidates that were offered to the model.</param>
    /// <returns>The slugs the model approved.</returns>
    private static ImmutableHashSet<string> MapApprovalsToApprovedSlugs(
        ImmutableDictionary<string, TagApprovalDecision> byName,
        IReadOnlyCollection<AiTagCandidate> candidates) =>
        [.. candidates
            .Where(candidate => byName.TryGetValue(candidate.Name, out var decision) && decision.Approved)
            .Select(candidate => candidate.Slug)];

    /// <summary>
    /// Fills the prompt template with the problem and candidate data and runs one Gemini call. The unfilled template
    /// is the system prompt (it carries the rules); the filled copy is the user prompt.
    /// </summary>
    /// <param name="config">The model, prompt path, and thinking budget for this pass.</param>
    /// <param name="statement">The problem statement.</param>
    /// <param name="solution">The problem solution, or null when statement-only.</param>
    /// <param name="candidateTagsJson">The candidate tags serialized for the prompt's <c>{candidate_tags}</c> slot.</param>
    /// <param name="cancellationToken">A token to cancel the call.</param>
    /// <returns>The raw model response.</returns>
    private async Task<string> CallGeminiAsync(
        AiModelConfig config,
        string statement,
        string? solution,
        string candidateTagsJson,
        CancellationToken cancellationToken)
    {
        // Resolve the prompt path against the app's base directory so it's found regardless of the working directory.
        var promptPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, config.SystemPromptPath);

        // Load the prompt template for this pass.
        var template = await File.ReadAllTextAsync(promptPath, cancellationToken);

        // Substitute the problem and candidate data into the template's placeholders. The already-assigned slot is
        // empty here — a fresh draft has no previously-assigned tags to feed back.
        var userPrompt = template
            .Replace("{candidate_tags}", candidateTagsJson)
            .Replace("{problem_statement}", statement)
            .Replace("{problem_solution}", solution ?? string.Empty)
            .Replace("{already_assigned_tags_text}", string.Empty);

        // Run the call, wrapping any transport failure with context.
        return await GeneralUtilities.TryExecuteAsync(
            () => geminiService.GenerateContentAsync(config.Model, template, userPrompt, config.ThinkingBudget, cancellationToken),
            exception => throw new InvalidOperationException("Gemini error", exception))
            ?? throw new InvalidOperationException("Gemini returned no response.");
    }
}

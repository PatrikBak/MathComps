using MathComps.Cli.Tagging.Dtos;
using System.Collections.Immutable;
using MathComps.Domain.Tagging;
using MathComps.Infrastructure.Options;
using MathComps.Infrastructure.Services.Ai;
using MathComps.Shared.Io;
using MathComps.Shared.Serialization;

namespace MathComps.Cli.Tagging.Services;

/// <summary>
/// Implements <see cref="IAiTaggingService"/> over an <see cref="ILlmChatCaller"/>: puts the per-pass
/// instructions plus candidate vocabulary in the system message and the problem in the user message, then maps the
/// model's response back to slugs.
/// </summary>
/// <param name="chatCaller">The retrying chat caller backing every pass.</param>
public class AiTaggingService(ILlmChatCaller chatCaller)
    : IAiTaggingService
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
        ChatStepSettings step,
        CancellationToken cancellationToken = default)
    {
        // Nothing to ask about — return an empty result without burning a call.
        if (candidates.Count == 0)
            return new SuggestTagsResult([], []);

        // Offer the candidates to the model keyed by name in the shape the generate prompt expects.
        var payload = candidates.ToImmutableDictionary(
            candidate => candidate.Name,
            candidate => new GenerateCandidatePayload(candidate.Type, candidate.Description));

        // Run the call; the library binds the structured response for us.
        var response = await CallModelAsync<GeneratePassResponse>(
            step, statement, solution, payload.ToJson(), cancellationToken);

        // Map the names back to slugs, keeping the few unknowns aside for the human.
        return MapFitnessesToSlugs(response.Tags, candidates);
    }

    /// <inheritdoc/>
    public async Task<ImmutableHashSet<string>> VetoTagsAsync(
        string statement,
        string? solution,
        IReadOnlyCollection<AiTagCandidate> candidates,
        ChatStepSettings step,
        CancellationToken cancellationToken = default)
    {
        // Nothing proposed — nothing to veto.
        if (candidates.Count == 0)
            return [];

        // Present the proposed tags with their justifications in the shape the veto prompt expects.
        var payload = candidates.ToImmutableDictionary(
            candidate => candidate.Name,
            candidate => new VetoCandidatePayload(candidate.Type, candidate.Description, candidate.Justification));

        // Run the call; the library binds the structured response for us.
        var response = await CallModelAsync<VetoPassResponse>(
            step, statement, solution, payload.ToJson(), cancellationToken);

        // Keep only the slugs the model approved.
        return MapApprovalsToApprovedSlugs(response.Tags, candidates);
    }

    /// <summary>
    /// Maps the generate pass's scored entries back to slugs, separating out names that match no candidate.
    /// </summary>
    /// <param name="entries">The model's scored entries, keyed by tag name.</param>
    /// <param name="candidates">The candidates that were offered to the model.</param>
    /// <returns>The proposed tags keyed by slug, plus the unmatched names.</returns>
    private static SuggestTagsResult MapFitnessesToSlugs(
        ImmutableArray<TagFitnessEntry> entries,
        IReadOnlyCollection<AiTagCandidate> candidates)
    {
        // Resolve each offered name to its slug.
        var nameToSlug = candidates.ToImmutableDictionary(candidate => candidate.Name, candidate => candidate.Slug);

        // Collapse any duplicate name the model might emit so the slug keying can't throw.
        var byName = entries.DistinctBy(entry => entry.Name).ToImmutableArray();

        // Names that resolve become slug-keyed results.
        var known = byName
            .Where(entry => nameToSlug.ContainsKey(entry.Name))
            .ToImmutableDictionary(
                entry => nameToSlug[entry.Name],
                entry => new TagFitness(entry.GoodnessOfFit, entry.Justification));

        // Names the model invented outside the vocabulary are surfaced, not silently dropped.
        var unknown = byName
            .Where(entry => !nameToSlug.ContainsKey(entry.Name))
            .Select(entry => entry.Name)
            .ToImmutableArray();

        // Pair the resolved tags with the unmatched names.
        return new SuggestTagsResult(known, unknown);
    }

    /// <summary>
    /// Reduces the veto pass's decisions to the set of approved slugs.
    /// </summary>
    /// <param name="entries">The model's approve/reject decisions, keyed by tag name.</param>
    /// <param name="candidates">The candidates that were offered to the model.</param>
    /// <returns>The slugs the model approved.</returns>
    private static ImmutableHashSet<string> MapApprovalsToApprovedSlugs(
        ImmutableArray<TagApprovalEntry> entries,
        IReadOnlyCollection<AiTagCandidate> candidates)
    {
        // The names the model approved.
        var approvedNames = entries
            .Where(entry => entry.Approved)
            .Select(entry => entry.Name)
            .ToImmutableHashSet();

        // Keep the slug of every candidate whose name was approved.
        return
        [
            .. candidates
                .Where(candidate => approvedNames.Contains(candidate.Name))
                .Select(candidate => candidate.Slug)
        ];
    }

    /// <summary>
    /// Runs one pass: the prompt template (instructions, rules, and the candidate vocabulary) becomes the system
    /// message, and the problem itself becomes the user message. Keeping the per-pass instructions constant lets the
    /// model cache that prefix across problems. The caller returns the reply bound to <typeparamref name="TResponse"/>.
    /// </summary>
    /// <typeparam name="TResponse">The structured shape to bind the model's reply into.</typeparam>
    /// <param name="step">The prompt, model, and reasoning level this pass runs on.</param>
    /// <param name="statement">The problem statement.</param>
    /// <param name="solution">The problem solution, or null when statement-only.</param>
    /// <param name="candidateTagsJson">The candidate tags serialized for the prompt's <c>{candidate_tags}</c> slot.</param>
    /// <param name="cancellationToken">A token to cancel the call.</param>
    /// <returns>The bound model response.</returns>
    private async Task<TResponse> CallModelAsync<TResponse>(
        ChatStepSettings step,
        string statement,
        string? solution,
        string candidateTagsJson,
        CancellationToken cancellationToken)
    {
        // The system message is the instructions plus the candidate vocabulary — constant per pass, hence cacheable.
        var systemPrompt = (await FileUtilities.ReadAppFileAsync(step.Prompt, cancellationToken))
            .Replace("{candidate_tags}", candidateTagsJson);

        // The user message is just the problem: the statement, plus the solution on the passes that review it.
        var userPrompt = solution is null
            ? $"PROBLEM: {statement}"
            : $"PROBLEM: {statement}\nSOLUTION: {solution}";

        // Hand the prompts to the shared caller on this pass's model.
        var result = await chatCaller.CompleteAsync<TResponse>(
            ChatCallRequest.For(step, systemPrompt, userPrompt), cancellationToken);

        // Return the bound reply, dropping the cost and token figures the tagging pass doesn't track.
        return result.Value;
    }
}

using MathComps.Cli.Tagging.Dtos;
using System.Collections.Immutable;
using MathComps.Cli.Tagging.Settings;
using MathComps.Domain.Tagging;
using MathComps.Shared.Serialization;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.Options;
using ChatCompletionOptions = OpenAI.Chat.ChatCompletionOptions;

namespace MathComps.Cli.Tagging.Services;

/// <summary>
/// Implements <see cref="IAiTaggingService"/> over an <see cref="IChatClient"/>: puts the per-pass instructions
/// plus candidate vocabulary in the system message and the problem in the user message, then maps the model's
/// response back to slugs.
/// </summary>
/// <param name="chatClient">The chat client backing every pass.</param>
/// <param name="openRouterSettings">The OpenRouter connection settings, read for the reasoning-effort level.</param>
public class AiTaggingService(IChatClient chatClient, IOptions<OpenRouterSettings> openRouterSettings)
    : IAiTaggingService
{
    /// <summary>
    /// How many times to issue a single model call before giving up. OpenRouter occasionally returns a response the
    /// SDK can't parse (e.g. an empty finish reason) and re-routes on the next try, so a few attempts clears it.
    /// </summary>
    private const int MaxModelAttempts = 4;

    /// <summary>
    /// The chat options carrying OpenRouter's reasoning control, or null when reasoning is off so every call sends the
    /// exact body it would without this feature. Built once since it's the same across all passes.
    /// </summary>
    private readonly ChatOptions? _reasoningOptions = BuildReasoningOptions(openRouterSettings.Value.ReasoningEffort);

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
        string promptPath,
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
            promptPath, statement, solution, payload.ToJson(), cancellationToken);

        // Map the names back to slugs, keeping the few unknowns aside for the human.
        return MapFitnessesToSlugs(response.Tags, candidates);
    }

    /// <inheritdoc/>
    public async Task<ImmutableHashSet<string>> VetoTagsAsync(
        string statement,
        string? solution,
        IReadOnlyCollection<AiTagCandidate> candidates,
        string promptPath,
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
            promptPath, statement, solution, payload.ToJson(), cancellationToken);

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
    /// Builds the chat options that carry OpenRouter's reasoning control. The OpenAI SDK has no native field for it, so
    /// we hang a <see cref="ChatOptions.RawRepresentationFactory"/> off the request that patches a top-level
    /// <c>reasoning</c> object straight into the outgoing JSON body via the OpenAI options' JSON patch.
    /// </summary>
    /// <param name="reasoningEffort">The reasoning-effort level, or null to leave reasoning off.</param>
    /// <returns>The reasoning-carrying chat options, or null when no effort is configured.</returns>
    private static ChatOptions? BuildReasoningOptions(string? reasoningEffort)
    {
        // No effort configured — return null so the call sends its body untouched.
        if (string.IsNullOrWhiteSpace(reasoningEffort))
            return null;

        // Serialize the reasoning object once so the factory can patch the same bytes onto every request.
        var reasoningJson = $$"""{"effort":"{{reasoningEffort}}"}""";

        // Patch the reasoning object onto the OpenAI options the adapter builds for each request.
        return new ChatOptions
        {
            RawRepresentationFactory = _ =>
            {
                // Start from a fresh OpenAI options bag the adapter will fill with the normal chat params.
                var options = new ChatCompletionOptions();

                // Inject the top-level "reasoning" field the OpenAI SDK doesn't model natively. Patch is the SDK's
                // sanctioned hook for unmodeled fields; experimental only in that its shape may change.
#pragma warning disable SCME0001
                options.Patch.Set("$.reasoning"u8, System.Text.Encoding.UTF8.GetBytes(reasoningJson));
#pragma warning restore SCME0001

                // Hand the patched options back to the adapter as this request's raw representation.
                return options;
            }
        };
    }

    /// <summary>
    /// Runs one pass: the prompt template (instructions, rules, and the candidate vocabulary) becomes the system
    /// message, and the problem itself becomes the user message. Keeping the per-pass instructions constant lets the
    /// model cache that prefix across problems. The response is requested as a JSON schema so the library binds it
    /// straight into <typeparamref name="TResponse"/>.
    /// </summary>
    /// <typeparam name="TResponse">The structured shape to bind the model's reply into.</typeparam>
    /// <param name="promptPath">Path to the prompt template for this pass.</param>
    /// <param name="statement">The problem statement.</param>
    /// <param name="solution">The problem solution, or null when statement-only.</param>
    /// <param name="candidateTagsJson">The candidate tags serialized for the prompt's <c>{candidate_tags}</c> slot.</param>
    /// <param name="cancellationToken">A token to cancel the call.</param>
    /// <returns>The bound model response.</returns>
    private async Task<TResponse> CallModelAsync<TResponse>(
        string promptPath,
        string statement,
        string? solution,
        string candidateTagsJson,
        CancellationToken cancellationToken)
    {
        // Resolve the prompt path against the app's base directory so it's found regardless of the working directory.
        var resolvedPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, promptPath);

        // The system message is the instructions plus the candidate vocabulary — constant per pass, hence cacheable.
        var systemPrompt = (await File.ReadAllTextAsync(resolvedPath, cancellationToken))
            .Replace("{candidate_tags}", candidateTagsJson);

        // The user message is just the problem: the statement, plus the solution on the passes that review it.
        var userPrompt = solution is null
            ? $"PROBLEM: {statement}"
            : $"PROBLEM: {statement}\nSOLUTION: {solution}";

        // Retry transient failures: OpenRouter occasionally hands back a finish reason the SDK rejects (or a transient
        // transport error), and since it re-routes per request, a few attempts with a short backoff clears it.
        for (var attempt = 1; ; attempt++)
        {
            try
            {
                // Run the pass, requesting the schema-constrained reply so the library binds it for us; the reasoning
                // options ride along only when an effort level is configured.
                var response = await chatClient.GetResponseAsync<TResponse>(
                    [new ChatMessage(ChatRole.System, systemPrompt), new ChatMessage(ChatRole.User, userPrompt)],
                    _reasoningOptions,
                    useJsonSchemaResponseFormat: true,
                    cancellationToken: cancellationToken);

                // Hand back the bound result; this throws if the model's output couldn't be bound to the schema.
                return response.Result;
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                // Out of attempts — surface the failure with context for the caller to log.
                if (attempt >= MaxModelAttempts)
                    throw new InvalidOperationException(
                        $"Chat model error after {MaxModelAttempts} attempts: {exception.Message}", exception);

                // Back off briefly before re-issuing; OpenRouter may route to a cleaner provider next time.
                await Task.Delay(TimeSpan.FromSeconds(attempt), cancellationToken);
            }
        }
    }
}

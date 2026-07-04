using System.Text;
using MathComps.Infrastructure.Options;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.Options;
using Polly;
using Polly.Retry;
using ChatCompletionOptions = OpenAI.Chat.ChatCompletionOptions;

namespace MathComps.Infrastructure.Services.Ai;

/// <summary>
/// Implements <see cref="IOpenRouterChatCaller"/> over an <see cref="IChatClient"/> pointed at OpenRouter. Resolves the
/// per-call model and reasoning level (falling back to the configured defaults), routes the model through
/// <see cref="ChatOptions.ModelId"/>, patches the reasoning level onto the raw request body, and retries a handful of
/// times because OpenRouter occasionally hands back an unparseable response and re-routes on the next try.
/// </summary>
/// <param name="chatClient">The chat client backing every call, bound to the configured default model.</param>
/// <param name="settings">The OpenRouter connection settings, read for the default model and reasoning level.</param>
public class OpenRouterChatCaller(IChatClient chatClient, IOptions<OpenRouterSettings> settings)
    : IOpenRouterChatCaller
{
    /// <summary>
    /// How many times a failed call is re-issued before giving up; the first attempt plus these is the total tries.
    /// </summary>
    private const int MaxRetries = 3;

    /// <summary>
    /// The resilience pipeline every call runs through, re-issuing a failed call on any non-cancellation fault.
    /// </summary>
    private static readonly ResiliencePipeline _retryPipeline = new ResiliencePipelineBuilder()
        .AddRetry(new RetryStrategyOptions
        {
            ShouldHandle = new PredicateBuilder().Handle<Exception>(exception => exception is not OperationCanceledException),
            MaxRetryAttempts = MaxRetries,
            BackoffType = DelayBackoffType.Linear,
            Delay = TimeSpan.FromSeconds(1),
            UseJitter = false,
        })
        .Build();

    /// <inheritdoc/>
    public async Task<TResponse> CompleteAsync<TResponse>(
        string systemPrompt,
        string userPrompt,
        string? model = null,
        string? reasoningEffort = null,
        CancellationToken cancellationToken = default)
    {
        // Fall back to the configured default reasoning level when the call doesn't set its own.
        var effort = reasoningEffort ?? settings.Value.ReasoningEffort;

        // Build the per-call options carrying the model override and reasoning level, or null when neither applies.
        var options = BuildOptions(model, effort);

        // The two messages: instructions as system, the input the model acts on as user.
        ChatMessage[] messages =
        [
            new(ChatRole.System, systemPrompt),
            new(ChatRole.User, userPrompt),
        ];

        try
        {
            // Run request and response-binding inside the retry boundary: a bad body fails at the bind, after the HTTP
            // call already succeeded, so the bind must be re-issued along with the request.
            return await _retryPipeline.ExecuteAsync(async retryToken =>
            {
                // Request the schema-constrained reply so the library binds it for us.
                var response = await chatClient.GetResponseAsync<TResponse>(
                    messages,
                    options,
                    useJsonSchemaResponseFormat: true,
                    cancellationToken: retryToken);

                // Bind the reply to the response type; this throws — and so gets retried — when the body won't bind.
                return response.Result;
            }, cancellationToken);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            // Retries exhausted — surface the failure with context for the caller to log.
            throw new InvalidOperationException(
                $"Chat model error after {MaxRetries + 1} attempts: {exception.Message}", exception);
        }
    }

    /// <summary>
    /// Builds the chat options for one call: the model override (when the caller routes to a specific model) and the
    /// reasoning level (patched onto the raw body). Returns null when neither applies, so the request carries exactly
    /// the body it would without this feature.
    /// </summary>
    /// <param name="model">The model to route to, or null to leave the client's default model in place.</param>
    /// <param name="reasoningEffort">The reasoning level, or null to leave reasoning off.</param>
    /// <returns>The per-call chat options, or null when there's nothing to set.</returns>
    private static ChatOptions? BuildOptions(string? model, string? reasoningEffort)
    {
        // Whether a reasoning level is in play at all.
        var hasReasoning = !string.IsNullOrWhiteSpace(reasoningEffort);

        // Nothing to override — no options object, so the client sends its default model with no reasoning field.
        if (model is null && !hasReasoning)
            return null;

        // Start a fresh options bag to carry whatever this call overrides.
        var options = new ChatOptions();

        // Route this call to a specific model when the caller overrides the client's default.
        if (model is not null)
            options.ModelId = model;

        // Patch the reasoning object onto the outgoing body when a level is set.
        if (hasReasoning)
            options.RawRepresentationFactory = _ => BuildReasoningRepresentation(reasoningEffort!);

        // Hand back the populated options.
        return options;
    }

    /// <summary>
    /// Builds the OpenAI request options carrying OpenRouter's reasoning control. The OpenAI SDK has no native field for
    /// it, so we patch a top-level <c>reasoning</c> object straight into the outgoing JSON body via the options' JSON
    /// patch.
    /// </summary>
    /// <param name="reasoningEffort">The reasoning-effort level to send.</param>
    /// <returns>The OpenAI request options with the reasoning object patched in.</returns>
    private static ChatCompletionOptions BuildReasoningRepresentation(string reasoningEffort)
    {
        // Serialize the reasoning object for this call.
        var reasoningJson = $$"""{"effort":"{{reasoningEffort}}"}""";

        // Start from a fresh OpenAI options bag the adapter will fill with the normal chat params.
        var options = new ChatCompletionOptions();

        // Inject the top-level "reasoning" field the OpenAI SDK doesn't model natively. Patch is the SDK's sanctioned
        // hook for unmodeled fields; experimental only in that its shape may change.
#pragma warning disable SCME0001
        options.Patch.Set("$.reasoning"u8, Encoding.UTF8.GetBytes(reasoningJson));
#pragma warning restore SCME0001

        // Hand the patched options back to the adapter as this call's raw representation.
        return options;
    }
}

using System.Text;
using MathComps.Infrastructure.Options;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.Options;
using OpenAI;
using Polly;
using Polly.Retry;
using ChatCompletion = OpenAI.Chat.ChatCompletion;
using ChatCompletionOptions = OpenAI.Chat.ChatCompletionOptions;

namespace MathComps.Infrastructure.Services.Ai;

/// <summary>
/// Implements <see cref="IOpenRouterChatCaller"/> over an <see cref="OpenAIClient"/> pointed at OpenRouter. Derives a
/// model-bound client per call, patches the reasoning level onto the raw request body, and retries a configured
/// number of times because OpenRouter occasionally hands back an unparseable response and re-routes on the next try.
/// A reply that hit the output-token cap is retried the same way. Each reply's billed cost is folded into the spend
/// tally as it lands, retries included.
/// </summary>
/// <param name="openAIClient">The OpenRouter connection; each call derives its model-bound client from it.</param>
/// <param name="spendTracker">The tally every reply's billed cost is folded into.</param>
/// <param name="settings">The connection settings, carrying the retry count and delay the pipeline is built from.</param>
public class OpenRouterChatCaller(
    OpenAIClient openAIClient, IOpenRouterSpendTracker spendTracker, IOptions<OpenRouterSettings> settings)
    : IOpenRouterChatCaller
{
    /// <summary>
    /// The resilience pipeline every call runs through, re-issuing a failed call on any non-cancellation fault. A retry
    /// count below one means no retries — the call runs once through an empty pipeline.
    /// </summary>
    private readonly ResiliencePipeline _retryPipeline = settings.Value.MaxRetries < 1
        ? ResiliencePipeline.Empty
        : new ResiliencePipelineBuilder()
            .AddRetry(new RetryStrategyOptions
            {
                ShouldHandle = new PredicateBuilder().Handle<Exception>(
                    exception => exception is not OperationCanceledException),
                MaxRetryAttempts = settings.Value.MaxRetries,
                BackoffType = DelayBackoffType.Linear,
                Delay = settings.Value.RetryDelay,
                UseJitter = false,
            })
            .Build();

    /// <inheritdoc/>
    public async Task<TResponse> CompleteAsync<TResponse>(
        string systemPrompt,
        string userPrompt,
        string model,
        string? reasoningEffort = null,
        int? maxOutputTokens = null,
        CancellationToken cancellationToken = default)
    {
        // The model-bound client for this call, derived from the shared connection.
        var chatClient = openAIClient.GetChatClient(model).AsIChatClient();

        // The per-call options carry the output-token cap and the reasoning level when set; with neither, the request
        // uses its default body.
        var options = maxOutputTokens is null && string.IsNullOrWhiteSpace(reasoningEffort)
            ? null
            : new ChatOptions
            {
                MaxOutputTokens = maxOutputTokens,
                RawRepresentationFactory = string.IsNullOrWhiteSpace(reasoningEffort)
                    ? null
                    : _ => BuildReasoningRepresentation(reasoningEffort),
            };

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

                // OpenRouter prices every reply in its raw body's usage; tally the figure before any verdict on the
                // reply, so a rejected attempt still counts what it billed. Patch — the SDK's only sanctioned hook
                // for fields it doesn't model, like this cost — is experimental only in that its shape may change in
                // a future SDK, hence the suppression.
#pragma warning disable SCME0001
                if (response.RawRepresentation is ChatCompletion completion
                    && completion.Patch.TryGetValue("$.usage.cost"u8, out decimal cost))
                    spendTracker.Add(cost);
#pragma warning restore SCME0001

                // A Length finish means the reply hit the token cap before finishing; throw so the retry draws a
                // fresh sample.
                if (response.FinishReason == ChatFinishReason.Length)
                    throw new InvalidOperationException(
                        "The reply hit the output-token cap before finishing; raise MaxOutputTokens for this step.");

                // Bind the reply to the response type; this throws — and so gets retried — when the body won't bind.
                return response.Result;
            }, cancellationToken);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            // Retries exhausted — surface the failure with context for the caller to log.
            throw new InvalidOperationException(
                $"Chat model error after {settings.Value.MaxRetries + 1} attempts: {exception.Message}", exception);
        }
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

        // Set the top-level "reasoning" field on the options' raw JSON body — via the experimental Patch hook.
#pragma warning disable SCME0001
        options.Patch.Set("$.reasoning"u8, Encoding.UTF8.GetBytes(reasoningJson));
#pragma warning restore SCME0001

        // Hand the patched options back to the adapter as this call's raw representation.
        return options;
    }
}

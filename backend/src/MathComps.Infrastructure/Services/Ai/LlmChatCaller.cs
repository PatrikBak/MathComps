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
/// Implements <see cref="ILlmChatCaller"/> over an <see cref="OpenAIClient"/> pointed at the configured endpoint
/// (OpenRouter today). Derives a model-bound client per call, patches the reasoning level onto the raw request body,
/// and retries a configured number of times because OpenRouter occasionally hands back an unparseable response and
/// re-routes on the next try. A reply that hit the output-token cap is retried the same way. Each reply's billed
/// cost is folded into the spend tally as it lands, retries included.
/// </summary>
/// <param name="openAIClient">The connection to the configured endpoint; each call derives its model-bound client
/// from it.</param>
/// <param name="spendTracker">The tally every reply's billed cost is folded into.</param>
/// <param name="settings">The connection settings, carrying the retry count and delay the pipeline is built from.</param>
public class LlmChatCaller(
    OpenAIClient openAIClient, ILlmSpendTracker spendTracker, IOptions<LlmSettings> settings)
    : ILlmChatCaller
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
    public async Task<ChatCallResult<TResponse>> CompleteAsync<TResponse>(
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

        // Every attempt's billing, summed across retries: a rejected attempt still billed, so the returned
        // usage must count it too.
        var accumulatedUsage = ModelUsage.Zero;

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

                // What this call billed, left at zero unless the raw body exposes it below.
                decimal cost = 0;
                var promptTokens = 0;
                var completionTokens = 0;

                // OpenRouter's cost is read through Patch, the SDK's sanctioned hook for fields it doesn't model;
                // SCME0001 marks Patch experimental (its shape may change in a later SDK), so the suppression is
                // scoped to this block.
#pragma warning disable SCME0001

                // RawRepresentation is the provider's native response behind the Microsoft.Extensions.AI abstraction,
                // typed as object? — it's an OpenAI ChatCompletion only when that client answered directly. Put any
                // other IChatClient in the pipeline (a test fake, or middleware that doesn't forward the raw body), or
                // let the SDK hand back null, and it's a different type with no usage to read, so cost/tokens stay zero.
                if (response.RawRepresentation is ChatCompletion completion)
                {
                    // OpenRouter prices the reply in its raw body's usage.
                    if (completion.Patch.TryGetValue("$.usage.cost"u8, out decimal billed))
                        cost = billed;

                    // The token counts come straight off the completion's usage.
                    promptTokens = completion.Usage?.InputTokenCount ?? 0;
                    completionTokens = completion.Usage?.OutputTokenCount ?? 0;
                }
#pragma warning restore SCME0001

                // Fold this attempt's billing into the running total before any verdict on the reply, so a rejected
                // attempt still counts — in both the process-wide tally and the usage this call ultimately returns.
                accumulatedUsage += new ModelUsage(cost, promptTokens, completionTokens);
                spendTracker.Add(cost);

                // A Length finish means the reply hit the token cap before finishing; throw so the retry draws a
                // fresh sample.
                if (response.FinishReason == ChatFinishReason.Length)
                    throw new InvalidOperationException(
                        "The reply hit the output-token cap before finishing; raise MaxOutputTokens for this step.");

                // Bind the reply to the response type (this throws — and so gets retried — when the body won't bind)
                // and pair it with everything this call billed, retries included.
                return new ChatCallResult<TResponse>(response.Result, accumulatedUsage);
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

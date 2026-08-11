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
/// Implements <see cref="ILlmChatCaller"/> over an <see cref="OpenAIClient"/> pointed at the configured
/// OpenAI-compatible endpoint. Derives a model-bound client per call, patches the reasoning level onto the raw
/// request body, and retries a configured number of times because the endpoint occasionally hands back an unusable
/// response, so a retry draws a fresh one. A reply that hit the output-token cap is retried the same way. Each reply's
/// billed cost is folded into the spend tally as it lands, retries included.
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
    public Task<ChatCallResult<TResponse>> CompleteAsync<TResponse>(
        ChatCallRequest request, CancellationToken cancellationToken = default)
    {
        // Issues the schema-constrained request, so the library binds the reply for us.
        static async Task<ChatResponse> SendAsync(
            IChatClient chatClient, ChatMessage[] messages, ChatOptions? options, CancellationToken retryToken) =>
            await chatClient.GetResponseAsync<TResponse>(
                messages, options, useJsonSchemaResponseFormat: true, cancellationToken: retryToken);

        // Reads the bound reply off the typed response that send always produces, throwing when the body won't bind.
        static TResponse ReadResult(ChatResponse response) => ((ChatResponse<TResponse>)response).Result;

        // Hand the pair to the shared request/accounting/retry core.
        return RunAsync(request, SendAsync, ReadResult, cancellationToken);
    }

    /// <inheritdoc/>
    public Task<ChatCallResult<string>> CompleteTextAsync(
        ChatCallRequest request, CancellationToken cancellationToken = default)
    {
        // Issues an unconstrained request: the completion's own text is the payload, so nothing re-escapes it.
        static async Task<ChatResponse> SendAsync(
            IChatClient chatClient, ChatMessage[] messages, ChatOptions? options, CancellationToken retryToken) =>
            await chatClient.GetResponseAsync(messages, options, retryToken);

        // Reads the reply's text, throwing on a blank draw — as unusable as a body that won't bind.
        static string ReadText(ChatResponse response) =>
            string.IsNullOrWhiteSpace(response.Text)
                ? throw new InvalidOperationException("The reply came back with no text.")
                : response.Text.Trim();

        // Hand the pair to the shared request/accounting/retry core.
        return RunAsync(request, SendAsync, ReadText, cancellationToken);
    }

    /// <summary>
    /// Runs one completion through the retry pipeline, whatever shape the reply is read in: derives the model-bound
    /// client, builds the per-call options and the two messages, and on every attempt folds the billing in before
    /// judging the reply, so a rejected attempt still counts.
    /// </summary>
    /// <typeparam name="TResult">The shape the reply is read into.</typeparam>
    /// <param name="request">The call's two messages, the model it routes to, and its limits.</param>
    /// <param name="send">Issues the request against the model-bound client.</param>
    /// <param name="read">Pulls the result out of the reply, throwing when the reply is unusable.</param>
    /// <param name="cancellationToken">A token to cancel the call.</param>
    /// <returns>The read reply together with the call's billed cost and token usage.</returns>
    private async Task<ChatCallResult<TResult>> RunAsync<TResult>(
        ChatCallRequest request,
        Func<IChatClient, ChatMessage[], ChatOptions?, CancellationToken, Task<ChatResponse>> send,
        Func<ChatResponse, TResult> read,
        CancellationToken cancellationToken)
    {
        // The model-bound client for this call, derived from the shared connection.
        var chatClient = openAIClient.GetChatClient(request.Model).AsIChatClient();

        // The per-call options carry the output-token cap and the reasoning level when set; with neither, the request
        // uses its default body.
        var options = request.MaxOutputTokens is null && string.IsNullOrWhiteSpace(request.ReasoningEffort)
            ? null
            : new ChatOptions
            {
                MaxOutputTokens = request.MaxOutputTokens,
                RawRepresentationFactory = string.IsNullOrWhiteSpace(request.ReasoningEffort)
                    ? null
                    : _ => BuildReasoningRepresentation(request.ReasoningEffort),
            };

        // The two messages: instructions as system, the input the model acts on as user.
        ChatMessage[] messages =
        [
            new(ChatRole.System, request.SystemPrompt),
            new(ChatRole.User, request.UserPrompt),
        ];

        // Every attempt's billing, summed across retries: a rejected attempt still billed, so the returned
        // usage must count it too.
        var accumulatedUsage = ModelUsage.Zero;

        try
        {
            // Run request and reading inside the retry boundary: an unusable reply fails at the read, after the HTTP
            // call already succeeded, so the read must be re-issued along with the request.
            return await _retryPipeline.ExecuteAsync(async retryToken =>
            {
                // Issue this attempt's request.
                var response = await send(chatClient, messages, options, retryToken);

                // What this attempt billed.
                var usage = ReadUsage(response);

                // Fold it in before any verdict on the reply, so a rejected attempt still counts — in both the
                // process-wide tally and the usage this call ultimately returns.
                accumulatedUsage += usage;
                spendTracker.Add(usage.Cost);

                // A Length finish means the reply hit the token cap before finishing; throw so the retry draws a
                // fresh sample.
                if (response.FinishReason == ChatFinishReason.Length)
                    throw new InvalidOperationException(
                        "The reply hit the output-token cap before finishing; raise MaxOutputTokens for this step.");

                // Read the result out of the reply and pair it with everything this call billed, retries included.
                return new ChatCallResult<TResult>(read(response), accumulatedUsage);
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
    /// Reads what one attempt billed off the provider's native response: the endpoint's cost alongside the prompt,
    /// completion, reasoning and cache-served token counts, each left at zero when the raw body doesn't carry it.
    /// </summary>
    /// <param name="response">The reply whose raw body carries the billing.</param>
    /// <returns>The attempt's billed cost and token counts.</returns>
    private static ModelUsage ReadUsage(ChatResponse response)
    {
        // What this call billed, left at zero unless the raw body exposes it below.
        decimal cost = 0;
        var promptTokens = 0;
        var cachedPromptTokens = 0;
        var completionTokens = 0;
        var reasoningTokens = 0;

        // The endpoint's cost is read through Patch, the SDK's sanctioned hook for fields it doesn't model;
        // SCME0001 marks Patch experimental (its shape may change in a later SDK), so the suppression is
        // scoped to this block.
#pragma warning disable SCME0001

        // RawRepresentation is the provider's native response behind the Microsoft.Extensions.AI abstraction,
        // typed as object? — it's an OpenAI ChatCompletion only when that client answered directly. Put any
        // other IChatClient in the pipeline (a test fake, or middleware that doesn't forward the raw body), or
        // let the SDK hand back null, and it's a different type with no usage to read, so cost/tokens stay zero.
        if (response.RawRepresentation is ChatCompletion completion)
        {
            // The endpoint prices the reply at the raw body's top level.
            if (completion.Patch.TryGetValue("$.cost"u8, out decimal billed))
                cost = billed;

            // The prompt (input) token count comes straight off the completion's usage.
            promptTokens = completion.Usage?.InputTokenCount ?? 0;

            // The cache-served prompt tokens ride in the prompt detail, a discounted subset of that count;
            // missing when caching isn't active, leaving it zero.
            if (completion.Patch.TryGetValue("$.usage.prompt_tokens_details.cached_tokens"u8, out int cached))
                cachedPromptTokens = cached;

            // The completion (output) token count comes straight off the completion's usage.
            completionTokens = completion.Usage?.OutputTokenCount ?? 0;

            // The reasoning tokens ride in the completion detail, the thinking portion already counted within
            // that count; missing when the model reports none, leaving it zero.
            if (completion.Patch.TryGetValue("$.usage.completion_tokens_details.reasoning_tokens"u8, out int reasoning))
                reasoningTokens = reasoning;
        }
#pragma warning restore SCME0001

        // Hand back what this attempt cost and consumed.
        return new ModelUsage(cost, promptTokens, completionTokens, reasoningTokens, cachedPromptTokens);
    }

    /// <summary>
    /// Builds the OpenAI request options carrying the endpoint's reasoning control. The OpenAI SDK has no native field for
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

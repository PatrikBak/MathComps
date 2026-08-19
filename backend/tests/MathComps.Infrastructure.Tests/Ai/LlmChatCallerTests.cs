using System.ClientModel;
using System.ClientModel.Primitives;
using System.Net;
using System.Text;
using System.Text.Json;
using MathComps.Infrastructure.Options;
using MathComps.Infrastructure.Services.Ai;
using OpenAI;
using MsOptions = Microsoft.Extensions.Options.Options;

namespace MathComps.Infrastructure.Tests.Ai;

/// <summary>
/// Tests the parts of <see cref="LlmChatCaller"/> the OpenAI SDK models no field for, all of which fail silently: the
/// fields patched onto the outgoing request body, and the model read back off the reply. A fake HTTP transport stands
/// in for the endpoint, so the body is inspected as sent and the reply is canned.
/// </summary>
public class LlmChatCallerTests
{
    /// <summary>
    /// A reply from a model other than the one asked for, priced and counted the way the endpoint prices and counts
    /// one — cost at the body's top level, beside the standard usage block.
    /// </summary>
    private const string CompletionJson = /*lang=json,strict*/ """
        {
          "id": "chatcmpl-test",
          "object": "chat.completion",
          "created": 1750000000,
          "model": "anthropic/claude-haiku-4-5",
          "choices": [
            {
              "index": 0,
              "finish_reason": "stop",
              "message": { "role": "assistant", "content": "a reply." }
            }
          ],
          "usage": { "prompt_tokens": 120, "completion_tokens": 30, "total_tokens": 150 },
          "cost": 0.0042
        }
        """;

    /// <summary>
    /// A step's fallback chain reaches the wire as a top-level <c>fallbacks</c> array, in order, alongside the
    /// reasoning object. A dropped patch still gets a normal reply off the primary, so nothing else would catch it.
    /// </summary>
    [Fact]
    public async Task A_configured_chain_reaches_the_request_body()
    {
        // A call routed to a primary with two backups behind it, thinking hard.
        var request = Request(["openai/gpt-5-mini", "anthropic/claude-haiku-4-5"], reasoningEffort: "high");

        // Send it through the fake transport.
        var (body, _) = await SendAsync(request);

        // The chain rode along as a top-level array, in order.
        var fallbacks = body.RootElement.GetProperty("fallbacks")
            .EnumerateArray().Select(entry => entry.GetString()).ToList();
        Assert.Equal(["openai/gpt-5-mini", "anthropic/claude-haiku-4-5"], fallbacks);

        // The reasoning object rode along with it, rather than one field's patch displacing the other.
        Assert.Equal("high", body.RootElement.GetProperty("reasoning").GetProperty("effort").GetString());
    }

    /// <summary>
    /// A step with no chain configured sends no <c>fallbacks</c> field at all, rather than an empty array the endpoint
    /// is free to read as a claim about routing.
    /// </summary>
    [Fact]
    public async Task An_empty_chain_sends_no_fallbacks_field()
    {
        // A call routed to a primary alone.
        var request = Request([], reasoningEffort: "low");

        // Send it through the fake transport.
        var (body, _) = await SendAsync(request);

        // Nothing about fallbacks reached the body, while the rest of the patched fields still did.
        Assert.False(body.RootElement.TryGetProperty("fallbacks", out _));
        Assert.Equal("low", body.RootElement.GetProperty("reasoning").GetProperty("effort").GetString());
    }

    /// <summary>
    /// The result names the model that answered rather than the one asked for, so a fallback-served call is not filed
    /// under a model that never ran. The billed cost comes off the same reply.
    /// </summary>
    [Fact]
    public async Task The_result_carries_the_model_that_answered()
    {
        // A call routed to a primary the canned reply pointedly does not come from.
        var request = Request(["anthropic/claude-haiku-4-5"], reasoningEffort: "medium");

        // Send it through the fake transport.
        var (_, result) = await SendAsync(request);

        // The reply's own model is what came back, not the request's.
        Assert.Equal("anthropic/claude-haiku-4-5", result.ServedModel);
        Assert.NotEqual(request.Model, result.ServedModel);

        // The endpoint's price and token counts came off the same reply.
        Assert.Equal(0.0042m, result.Usage.Cost);
        Assert.Equal(120, result.Usage.PromptTokens);
        Assert.Equal(30, result.Usage.CompletionTokens);
    }

    /// <summary>
    /// Builds a plain-text call routed to a fixed primary with the given chain behind it.
    /// </summary>
    /// <param name="fallbackModels">The backup models to configure behind the primary.</param>
    /// <param name="reasoningEffort">The reasoning-effort level to send.</param>
    /// <returns>The request, ready to send.</returns>
    private static ChatCallRequest Request(IReadOnlyList<string> fallbackModels, string reasoningEffort) =>
        new("instructions", "the input", "google/gemini-3.6-flash", fallbackModels, reasoningEffort,
            MaxOutputTokens: 2048);

    /// <summary>
    /// Runs one plain-text call against a caller wired to a fake transport, handing back both sides of the exchange.
    /// Retries are off, so exactly one request is captured.
    /// </summary>
    /// <param name="request">The call to send.</param>
    /// <returns>The request body as it went out, and the result the caller read back.</returns>
    private static async Task<(JsonDocument Body, ChatCallResult<string> Result)> SendAsync(ChatCallRequest request)
    {
        // The endpoint stand-in: it records what it was sent and always answers with the canned reply.
        var handler = new CapturingHandler(CompletionJson);

        // An OpenAI client whose transport is that stand-in, so no socket is opened.
        using var httpClient = new HttpClient(handler);
        var openAIClient = new OpenAIClient(
            new ApiKeyCredential("test-key"),
            new OpenAIClientOptions
            {
                Endpoint = new Uri("https://endpoint.test/v3/llm"),
                Transport = new HttpClientPipelineTransport(httpClient),
            });

        // Connection settings with retries off, so one call means one captured request.
        var settings = new LlmSettings
        {
            BaseUrl = "https://endpoint.test/v3/llm",
            ApiKey = "test-key",
            MaxRetries = 0,
            RetryDelay = TimeSpan.Zero,
        };

        // The real caller over that client.
        var caller = new LlmChatCaller(openAIClient, new LlmSpendTracker(), MsOptions.Create(settings));

        // Make the call.
        var result = await caller.CompleteTextAsync(request);

        // Hand back the body as it went out alongside what the caller made of the reply.
        return (JsonDocument.Parse(handler.CapturedBody), result);
    }

    /// <summary>
    /// An HTTP handler standing in for the endpoint: it keeps the body of the request it was handed and answers every
    /// one with the same canned reply.
    /// </summary>
    /// <param name="responseJson">The reply body to answer with.</param>
    private sealed class CapturingHandler(string responseJson) : HttpMessageHandler
    {
        /// <summary>
        /// The body of the last request this handler was given.
        /// </summary>
        public string CapturedBody { get; private set; } = "";

        /// <inheritdoc/>
        protected override async Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request, CancellationToken cancellationToken)
        {
            // Keep the outgoing body, which is the thing under test.
            CapturedBody = request.Content is null
                ? ""
                : await request.Content.ReadAsStringAsync(cancellationToken);

            // Answer with the canned reply.
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(responseJson, Encoding.UTF8, "application/json"),
            };
        }
    }
}

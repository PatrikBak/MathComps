using System.ClientModel;
using System.ClientModel.Primitives;
using System.Net;
using System.Text;
using System.Text.Json;
using MathComps.Infrastructure.Options;
using MathComps.Infrastructure.Services.Ai;
using Microsoft.Extensions.Logging.Abstractions;
using OpenAI;
using MsOptions = Microsoft.Extensions.Options.Options;

namespace MathComps.Infrastructure.Tests.TestInfrastructure;

/// <summary>
/// A stand-in for the chat endpoint, with the real <see cref="LlmChatCaller"/> wired to it: it keeps the body of every
/// request it is sent and answers each one with the same reply. Retries are off, so one call is one request.
/// </summary>
public sealed class FakeChatEndpoint : IDisposable
{
    /// <summary>
    /// The HTTP client the caller sends through, which never opens a socket.
    /// </summary>
    private readonly HttpClient _httpClient;

    /// <summary>
    /// The body of every request sent, in order.
    /// </summary>
    private readonly List<JsonElement> _requests = [];

    /// <summary>
    /// Builds the endpoint answering every request with the given reply body.
    /// </summary>
    /// <param name="responseJson">The whole chat-completion body to answer with.</param>
    public FakeChatEndpoint(string responseJson)
    {
        // The client over a handler keeping each request and answering with the reply.
        _httpClient = new HttpClient(new RecordingHandler(responseJson, _requests));

        // An OpenAI client sending through it.
        var openAIClient = new OpenAIClient(
            new ApiKeyCredential("test-key"),
            new OpenAIClientOptions
            {
                Endpoint = new Uri("https://endpoint.test/v3"),
                Transport = new HttpClientPipelineTransport(_httpClient),
            });

        // Connection settings with retries off.
        var settings = new LlmSettings
        {
            BaseUrl = "https://endpoint.test/v3",
            ApiKey = "test-key",
            MaxRetries = 0,
            RetryDelay = TimeSpan.Zero,
            RequestTimeout = TimeSpan.FromSeconds(30),
        };

        // The real caller over the OpenAI client.
        Caller = new LlmChatCaller(
            openAIClient, new LlmSpendTracker(), NullLogger<LlmChatCaller>.Instance, MsOptions.Create(settings));
    }

    /// <summary>
    /// The caller whose requests reach this endpoint.
    /// </summary>
    public LlmChatCaller Caller { get; }

    /// <inheritdoc cref="_requests" path="/summary"/>
    public IReadOnlyList<JsonElement> Requests => _requests;

    /// <summary>
    /// Builds the endpoint answering every request with a reply holding the given message content, served by
    /// <c>test-model</c> at no cost.
    /// </summary>
    /// <param name="content">The assistant message's content, such as a structured reply's JSON.</param>
    /// <returns>The endpoint.</returns>
    public static FakeChatEndpoint Answering(string content)
    {
        // A chat-completion body carrying the content, as a JSON string, as its one choice.
        var responseJson = $$"""
            {
              "id": "chatcmpl-test",
              "object": "chat.completion",
              "created": 1750000000,
              "model": "test-model",
              "choices": [
                {
                  "index": 0,
                  "finish_reason": "stop",
                  "message": { "role": "assistant", "content": {{JsonSerializer.Serialize(content)}} }
                }
              ],
              "usage": { "prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2 },
              "cost": 0
            }
            """;

        // The endpoint answering with it.
        return new FakeChatEndpoint(responseJson);
    }

    /// <inheritdoc/>
    public void Dispose() =>
        _httpClient.Dispose();

    /// <summary>
    /// An HTTP handler standing in for the endpoint: it keeps the body of each request it is handed and answers every
    /// one with the same reply.
    /// </summary>
    /// <param name="responseJson">The reply body to answer with.</param>
    /// <param name="requests">The list each request's body is added to.</param>
    private sealed class RecordingHandler(string responseJson, List<JsonElement> requests) : HttpMessageHandler
    {
        /// <inheritdoc/>
        protected override async Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request, CancellationToken cancellationToken)
        {
            // The outgoing body.
            var body = await request.Content!.ReadAsStringAsync(cancellationToken);

            // Keep it parsed.
            requests.Add(JsonElement.Parse(body));

            // Answer with the reply.
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(responseJson, Encoding.UTF8, "application/json"),
            };
        }
    }
}

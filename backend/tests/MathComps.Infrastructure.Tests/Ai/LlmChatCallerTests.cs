using System.Net.Mime;
using System.Text.Json;
using MathComps.Infrastructure.Services.Ai;
using MathComps.Infrastructure.Tests.TestInfrastructure;

namespace MathComps.Infrastructure.Tests.Ai;

/// <summary>
/// Tests the parts of <see cref="LlmChatCaller"/> that fail silently when dropped or misnamed: the messages and request
/// fields the endpoint reads (the instructions, an image's part, the order of the user message's parts, the reasoning
/// level and the fallback chain), and the model read back off the reply. A fake HTTP transport stands in for the
/// endpoint, so the body is inspected as sent and the reply is canned.
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
    /// A step's fallback chain reaches the wire as a top-level <c>fallbacks</c> array, in order, and its reasoning
    /// level as the top-level <c>reasoning_effort</c> string. The endpoint answers off the primary at its default
    /// effort whether a field is dropped or misnamed, so nothing else would catch either.
    /// </summary>
    [Fact]
    public async Task A_configured_chain_reaches_the_request_body()
    {
        // A call routed to a primary with two backups behind it, thinking hard.
        var request = Request(["openai/gpt-5-mini", "anthropic/claude-haiku-4-5"], reasoningEffort: "high");

        // Send it through the fake transport.
        var (body, _) = await SendAsync(request);

        // The chain rode along as a top-level array, in order.
        var fallbacks = body.GetProperty("fallbacks")
            .EnumerateArray().Select(entry => entry.GetString()).ToList();
        Assert.Equal(["openai/gpt-5-mini", "anthropic/claude-haiku-4-5"], fallbacks);

        // The reasoning level rode along with it, under the name the endpoint reads.
        Assert.Equal("high", body.GetProperty("reasoning_effort").GetString());
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

        // Nothing about fallbacks reached the body.
        Assert.False(body.TryGetProperty("fallbacks", out _));

        // The reasoning level still reached the body.
        Assert.Equal("low", body.GetProperty("reasoning_effort").GetString());
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
    /// A call's instructions go out as the system message, ahead of the user message. A call that
    /// loses them still gets a fluent reply, written without the instructions it was given.
    /// </summary>
    [Fact]
    public async Task The_instructions_go_out_as_the_system_message_first()
    {
        // A call carrying instructions and an input.
        var request = Request([], reasoningEffort: "low");

        // Send it through the fake transport.
        var (body, _) = await SendAsync(request);

        // The system message went first, then the user's.
        var messages = body.GetProperty("messages").EnumerateArray().ToList();
        Assert.Equal(["system", "user"], messages.Select(message => message.GetProperty("role").GetString()));

        // The system message carries the instructions.
        Assert.Equal("instructions", messages[0].GetProperty("content").GetString());
    }

    /// <summary>
    /// A call with no system prompt and an image sends one user message holding the text and then the image, as a
    /// base64 data URL in an <c>image_url</c> part. That part's shape is the one the endpoint reads an image from, and
    /// a call that loses it still gets a fluent reply about an image the model never saw.
    /// </summary>
    [Fact]
    public async Task An_image_rides_in_the_user_message_after_its_text()
    {
        // A few bytes standing in for a photo.
        byte[] photo = [0xFF, 0xD8, 0xFF, 0xE0, 0x01, 0x02];

        // A call whose instructions ride in the user message, with the photo shown after them.
        var request = Request([], reasoningEffort: "low") with
        {
            SystemPrompt = null,
            UserMessage = new ChatUserMessage(
                [new ChatText("Read this page."), new ChatImage(photo, MediaTypeNames.Image.Jpeg)]),
        };

        // Send it through the fake transport.
        var (body, _) = await SendAsync(request);

        // The one message sent is the user's.
        var message = Assert.Single(body.GetProperty("messages").EnumerateArray());
        Assert.Equal("user", message.GetProperty("role").GetString());

        // The message's content is the text part, then the image part.
        var parts = message.GetProperty("content").EnumerateArray().ToList();
        Assert.Equal(["text", "image_url"], parts.Select(part => part.GetProperty("type").GetString()));

        // The text part carries the instructions as written.
        Assert.Equal("Read this page.", parts[0].GetProperty("text").GetString());

        // The image part carries the photo's bytes as a data URL of its media type.
        Assert.Equal(
            $"data:image/jpeg;base64,{Convert.ToBase64String(photo)}",
            parts[1].GetProperty("image_url").GetProperty("url").GetString());
    }

    /// <summary>
    /// A user message's parts reach the wire in the order the message lists them, so an image sits between the texts
    /// around it. Sent with every text first and every image after, the call still gets a fluent reply, from a model
    /// that can no longer tell which words a drawing came with.
    /// </summary>
    [Fact]
    public async Task The_user_message_parts_keep_their_order()
    {
        // A few bytes standing in for a drawing.
        byte[] drawing = [0xFF, 0xD8, 0xFF, 0xE0, 0x03, 0x04];

        // A call whose user message holds a text, the drawing it came with, then a second text.
        var request = Request([], reasoningEffort: "low") with
        {
            UserMessage = new ChatUserMessage(
            [
                new ChatText("Their message."),
                new ChatImage(drawing, MediaTypeNames.Image.Jpeg),
                new ChatText("The reply to judge."),
            ]),
        };

        // Send it through the fake transport.
        var (body, _) = await SendAsync(request);

        // The user message is the one after the instructions.
        var message = body.GetProperty("messages").EnumerateArray().Last();
        Assert.Equal("user", message.GetProperty("role").GetString());

        // Its content is the text, the image, then the second text.
        var parts = message.GetProperty("content").EnumerateArray().ToList();
        Assert.Equal(["text", "image_url", "text"], parts.Select(part => part.GetProperty("type").GetString()));

        // Each text part carries its own text.
        Assert.Equal("Their message.", parts[0].GetProperty("text").GetString());
        Assert.Equal("The reply to judge.", parts[2].GetProperty("text").GetString());
    }

    /// <summary>
    /// Builds a text-only call with instructions as its system prompt, routed to a fixed primary with the given
    /// chain behind it.
    /// </summary>
    /// <param name="fallbackModels">The backup models to configure behind the primary.</param>
    /// <param name="reasoningEffort">The reasoning-effort level to send.</param>
    /// <returns>The request, ready to send.</returns>
    private static ChatCallRequest Request(IReadOnlyList<string> fallbackModels, string reasoningEffort) =>
        new("test-step", "instructions", new ChatUserMessage("the input"), "google/gemini-3.6-flash", fallbackModels,
            reasoningEffort, MaxOutputTokens: 2048);

    /// <summary>
    /// Runs one call, its reply read as text, through the real caller against an endpoint answering with the canned
    /// reply, handing back both sides of the exchange.
    /// </summary>
    /// <param name="request">The call to send.</param>
    /// <returns>The request body as it went out, and the result the caller read back.</returns>
    private static async Task<(JsonElement Body, ChatCallResult<string> Result)> SendAsync(ChatCallRequest request)
    {
        // The endpoint stand-in, answering with the canned reply.
        using var endpoint = new FakeChatEndpoint(CompletionJson);

        // Make the call.
        var result = await endpoint.Caller.CompleteTextAsync(request);

        // Hand back the one body that went out alongside what the caller made of the reply.
        return (Assert.Single(endpoint.Requests), result);
    }
}

using MathComps.Cli.Tagging.Services;
using MathComps.Cli.Tagging.Settings;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.Options;
using Moq;
using System.Collections.Immutable;
using MathComps.Domain.Tagging;

namespace MathComps.Cli.Tagging.Tests;

/// <summary>
/// Tests the database-free tagging core through its public passes with a mocked chat client: the generate pass puts
/// the candidates in the system message and the problem in the user message, then maps the model's list response
/// back to draft slugs (surfacing names outside the vocabulary), and the veto pass keeps only the slugs the model
/// approves.
/// </summary>
public class AiTaggingServiceTests
{
    /// <summary>
    /// A candidate vocabulary of two known tags used across the tests.
    /// </summary>
    private static readonly ImmutableArray<AiTagCandidate> _candidates =
    [
        new("algebra", "Algebra", TagType.Area, "Algebra description"),
        new("pigeonhole", "Pigeonhole Principle", TagType.Technique, "Pigeonhole description"),
    ];

    /// <summary>
    /// An empty candidate set short-circuits without a model call.
    /// </summary>
    [Fact]
    public async Task SuggestTags_returns_empty_without_calling_the_model_when_there_are_no_candidates()
    {
        // A model that fails the test if it is ever called.
        var chatClient = new Mock<IChatClient>(MockBehavior.Strict);
        var service = CreateService(chatClient.Object);

        // Suggest with an empty candidate set.
        var result = await service.SuggestTagsAsync("statement", null, [], "ignored");

        // Nothing proposed, nothing unknown, no call made.
        Assert.Empty(result.TagsBySlug);
        Assert.Empty(result.UnknownNames);
        chatClient.VerifyNoOtherCalls();
    }

    /// <summary>
    /// The generate pass puts the candidate vocabulary in the system message and the problem in the user message.
    /// </summary>
    [Fact]
    public async Task SuggestTags_splits_candidates_into_system_and_the_problem_into_user()
    {
        // A prompt template with the candidate slot, written to a real file the service reads.
        var promptPath = Path.GetTempFileName();
        await File.WriteAllTextAsync(promptPath, "INSTRUCTIONS T:{candidate_tags}");

        try
        {
            // Capture the messages the service sends, answering with one known tag so the call completes.
            IReadOnlyList<ChatMessage> capturedMessages = [];
            var chatClient = new Mock<IChatClient>();
            chatClient
                .Setup(client => client.GetResponseAsync(
                    It.IsAny<IEnumerable<ChatMessage>>(), It.IsAny<ChatOptions?>(), It.IsAny<CancellationToken>()))
                .Callback<IEnumerable<ChatMessage>, ChatOptions?, CancellationToken>(
                    (messages, _, _) => capturedMessages = [.. messages])
                .ReturnsAsync(new ChatResponse(new ChatMessage(ChatRole.Assistant,
                    /*lang=json,strict*/
                    """{ "tags": [ { "name": "Algebra", "goodnessOfFit": 0.9, "justification": "clearly algebra" } ] }""")));

            // Run the generate pass.
            var service = CreateService(chatClient.Object);
            await service.SuggestTagsAsync("the statement", "the solution", _candidates, promptPath);

            // The system message carries the instructions and the substituted candidate names.
            var systemMessage = capturedMessages.Single(message => message.Role == ChatRole.System).Text;
            Assert.Contains("INSTRUCTIONS", systemMessage);
            Assert.Contains("Algebra", systemMessage);

            // The user message carries just the problem — statement and solution, no candidates.
            var userMessage = capturedMessages.Single(message => message.Role == ChatRole.User).Text;
            Assert.Contains("PROBLEM: the statement", userMessage);
            Assert.Contains("SOLUTION: the solution", userMessage);
            Assert.DoesNotContain("Algebra", userMessage);
        }
        finally
        {
            // Clean up the temp prompt file.
            File.Delete(promptPath);
        }
    }

    /// <summary>
    /// The generate pass keys known names back to their slugs and surfaces a name with no candidate as unknown rather
    /// than dropping it.
    /// </summary>
    [Fact]
    public async Task SuggestTags_keys_known_names_by_slug_and_surfaces_unknown_ones()
    {
        // The model returns one known name and one it invented.
        var response = /*lang=json,strict*/ """
            { "tags": [
                { "name": "Algebra", "goodnessOfFit": 0.9, "justification": "clearly algebra" },
                { "name": "Made Up Tag", "goodnessOfFit": 0.8, "justification": "not in the vocabulary" } ] }
            """;

        // Run the generate pass against the stubbed model.
        var result = await RunWithStubbedModelAsync(response,
            (service, promptPath) => service.SuggestTagsAsync("statement", null, _candidates, promptPath));

        // The known name is keyed by slug; the invented one is reported, not kept.
        Assert.Equal(["algebra"], result.TagsBySlug.Keys);
        Assert.Equal(0.9f, result.TagsBySlug["algebra"].GoodnessOfFit);
        Assert.Equal(["Made Up Tag"], [.. result.UnknownNames]);
    }

    /// <summary>
    /// The veto pass keeps only the slugs whose decision is approved; rejected ones are dropped.
    /// </summary>
    [Fact]
    public async Task VetoTags_keeps_only_the_approved_slugs()
    {
        // The model approves one proposed tag and rejects the other.
        var response = /*lang=json,strict*/ """
            { "tags": [
                { "name": "Algebra", "approved": true, "justification": "" },
                { "name": "Pigeonhole Principle", "approved": false, "justification": "does not apply" } ] }
            """;

        // Run the veto pass against the stubbed model.
        var approved = await RunWithStubbedModelAsync(response,
            (service, promptPath) => service.VetoTagsAsync("statement", "solution", _candidates, promptPath));

        // Only the approved slug survives.
        Assert.Equal(["algebra"], approved);
    }

    /// <summary>
    /// Runs a tagging pass against a chat client stubbed to return <paramref name="cannedResponse"/>, using a
    /// throwaway prompt template so the service's prompt-file read succeeds.
    /// </summary>
    /// <typeparam name="TResult">The pass's result type.</typeparam>
    /// <param name="cannedResponse">The raw JSON the stubbed model returns.</param>
    /// <param name="pass">The pass to invoke on the configured service and prompt path.</param>
    /// <returns>The pass's result.</returns>
    private static async Task<TResult> RunWithStubbedModelAsync<TResult>(
        string cannedResponse, Func<IAiTaggingService, string, Task<TResult>> pass)
    {
        // A throwaway prompt template the pass can read.
        var promptPath = Path.GetTempFileName();
        await File.WriteAllTextAsync(promptPath, "{candidate_tags}");

        try
        {
            // A model that always answers with the canned response.
            var chatClient = new Mock<IChatClient>();
            chatClient
                .Setup(client => client.GetResponseAsync(
                    It.IsAny<IEnumerable<ChatMessage>>(), It.IsAny<ChatOptions?>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(new ChatResponse(new ChatMessage(ChatRole.Assistant, cannedResponse)));

            // Run the pass against the configured service.
            return await pass(CreateService(chatClient.Object), promptPath);
        }
        finally
        {
            // Clean up the temp prompt file.
            File.Delete(promptPath);
        }
    }

    /// <summary>
    /// Builds the tagging service over a chat client, with reasoning left off — these tests don't exercise it.
    /// </summary>
    /// <param name="chatClient">The chat client backing the passes.</param>
    /// <returns>The configured tagging service.</returns>
    private static AiTaggingService CreateService(IChatClient chatClient) =>
        new(chatClient, Options.Create(new OpenRouterSettings
        {
            BaseUrl = "https://example.test/v1",
            Model = "test-model",
            ApiKey = "test-key",
        }));
}

using MathComps.Cli.Tagging.Dtos;
using MathComps.Cli.Tagging.Services;
using MathComps.Infrastructure.Options;
using MathComps.Infrastructure.Services.Ai;
using Moq;
using System.Collections.Immutable;
using MathComps.Domain.Tagging;

namespace MathComps.Cli.Tagging.Tests;

/// <summary>
/// Tests the database-free tagging core through its public passes with a mocked chat caller: the generate pass puts
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
        // A caller that fails the test if it is ever invoked.
        var chatCaller = new Mock<ILlmChatCaller>(MockBehavior.Strict);
        var service = new AiTaggingService(chatCaller.Object);

        // Suggest with an empty candidate set.
        var result = await service.SuggestTagsAsync(
            "statement", null, [], new ChatStepSettings { Prompt = "ignored", Model = "test-model" });

        // Nothing proposed, nothing unknown, no call made.
        Assert.Empty(result.TagsBySlug);
        Assert.Empty(result.UnknownNames);
        chatCaller.VerifyNoOtherCalls();
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
            // Capture the prompts the service sends, answering with one known tag so the call completes.
            var capturedSystem = string.Empty;
            var capturedUser = string.Empty;
            var chatCaller = new Mock<ILlmChatCaller>();
            chatCaller
                .Setup(caller => caller.CompleteAsync<GeneratePassResponse>(
                    It.IsAny<ChatCallRequest>(), It.IsAny<CancellationToken>()))
                .Callback<ChatCallRequest, CancellationToken>(
                    (request, _) => (capturedSystem, capturedUser) = (request.SystemPrompt, request.UserPrompt))
                .ReturnsAsync(new ChatCallResult<GeneratePassResponse>(
                    new GeneratePassResponse([new TagFitnessEntry("Algebra", 0.9f, "clearly algebra")]),
                    "test-model", ModelUsage.Zero));

            // Run the generate pass.
            var service = new AiTaggingService(chatCaller.Object);
            await service.SuggestTagsAsync(
                "the statement", "the solution", _candidates,
                new ChatStepSettings { Prompt = promptPath, Model = "test-model" });

            // The system message carries the instructions and the substituted candidate names.
            Assert.Contains("INSTRUCTIONS", capturedSystem);
            Assert.Contains("Algebra", capturedSystem);

            // The user message carries just the problem — statement and solution, no candidates.
            Assert.Contains("PROBLEM: the statement", capturedUser);
            Assert.Contains("SOLUTION: the solution", capturedUser);
            Assert.DoesNotContain("Algebra", capturedUser);
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
        var response = new GeneratePassResponse(
        [
            new TagFitnessEntry("Algebra", 0.9f, "clearly algebra"),
            new TagFitnessEntry("Made Up Tag", 0.8f, "not in the vocabulary"),
        ]);

        // Run the generate pass against the stubbed caller.
        var result = await RunPassWithStubAsync(response,
            (service, promptPath) => service.SuggestTagsAsync(
                "statement", null, _candidates, new ChatStepSettings { Prompt = promptPath, Model = "test-model" }));

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
        var response = new VetoPassResponse(
        [
            new TagApprovalEntry("Algebra", true, ""),
            new TagApprovalEntry("Pigeonhole Principle", false, "does not apply"),
        ]);

        // Run the veto pass against the stubbed caller.
        var approved = await RunPassWithStubAsync(response,
            (service, promptPath) => service.VetoTagsAsync(
                "statement", "solution", _candidates, new ChatStepSettings { Prompt = promptPath, Model = "test-model" }));

        // Only the approved slug survives.
        Assert.Equal(["algebra"], approved);
    }

    /// <summary>
    /// Runs a tagging pass against a chat caller stubbed to return <paramref name="cannedResponse"/>, using a throwaway
    /// prompt template so the service's prompt-file read succeeds.
    /// </summary>
    /// <typeparam name="TResponse">The structured response the pass's model call binds into.</typeparam>
    /// <typeparam name="TResult">The pass's result type.</typeparam>
    /// <param name="cannedResponse">The bound response the stubbed caller returns.</param>
    /// <param name="pass">The pass to invoke on the configured service and prompt path.</param>
    /// <returns>The pass's result.</returns>
    private static async Task<TResult> RunPassWithStubAsync<TResponse, TResult>(
        TResponse cannedResponse, Func<IAiTaggingService, string, Task<TResult>> pass)
    {
        // A throwaway prompt template the pass can read.
        var promptPath = Path.GetTempFileName();
        await File.WriteAllTextAsync(promptPath, "{candidate_tags}");

        try
        {
            // A caller that always answers with the canned response.
            var chatCaller = new Mock<ILlmChatCaller>();
            chatCaller
                .Setup(caller => caller.CompleteAsync<TResponse>(
                    It.IsAny<ChatCallRequest>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(new ChatCallResult<TResponse>(cannedResponse, "test-model", ModelUsage.Zero));

            // Run the pass against the configured service.
            return await pass(new AiTaggingService(chatCaller.Object), promptPath);
        }
        finally
        {
            // Clean up the temp prompt file.
            File.Delete(promptPath);
        }
    }
}

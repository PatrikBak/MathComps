using MathComps.Cli.Tagging.Services;
using MathComps.Infrastructure.Options;
using MathComps.Infrastructure.Services.Integrations;
using MathComps.Shared;
using Moq;
using System.Collections.Immutable;

namespace MathComps.Cli.Tagging.Tests;

/// <summary>
/// Tests the database-free tagging core through its public passes with a mocked model: the generate pass fills the
/// prompt and maps the model's name-keyed response back to draft slugs (surfacing names outside the vocabulary), and
/// the veto pass keeps only the slugs the model approves.
/// </summary>
public class AiTaggingServiceTests
{
    /// <summary>
    /// A candidate vocabulary of two known tags used across the tests.
    /// </summary>
    private static readonly ImmutableArray<AiTagCandidate> _candidates =
    [
        new AiTagCandidate("algebra", "Algebra", TagType.Area, "Algebra description"),
        new AiTagCandidate("pigeonhole", "Pigeonhole Principle", TagType.Technique, "Pigeonhole description"),
    ];

    /// <summary>
    /// An empty candidate set short-circuits without a model call.
    /// </summary>
    [Fact]
    public async Task SuggestTags_returns_empty_without_calling_the_model_when_there_are_no_candidates()
    {
        // A model that fails the test if it is ever called.
        var gemini = new Mock<IGeminiService>(MockBehavior.Strict);
        var service = new AiTaggingService(gemini.Object);

        // Suggest with an empty candidate set.
        var result = await service.SuggestTagsAsync("statement", null, [], ModelConfig("ignored"));

        // Nothing proposed, nothing unknown, no call made.
        Assert.Empty(result.TagsBySlug);
        Assert.Empty(result.UnknownNames);
        gemini.VerifyNoOtherCalls();
    }

    /// <summary>
    /// The generate pass substitutes the statement, solution, and candidate names into the prompt's placeholders.
    /// </summary>
    [Fact]
    public async Task SuggestTags_substitutes_the_problem_and_candidates_into_the_prompt()
    {
        // A prompt template exercising every placeholder, written to a real file the service reads.
        var promptPath = Path.GetTempFileName();
        await File.WriteAllTextAsync(promptPath, "S:{problem_statement} X:{problem_solution} T:{candidate_tags}");

        try
        {
            // Capture the user prompt the service sends, answering with one known tag so the call completes.
            var capturedUserPrompt = "";
            var gemini = new Mock<IGeminiService>();
            gemini
                .Setup(model => model.GenerateContentAsync(
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
                .Callback<string, string, string, int, CancellationToken>((_, _, userPrompt, _, _) => capturedUserPrompt = userPrompt)
                .ReturnsAsync(/*lang=json,strict*/ """{ "Algebra": { "GoodnessOfFit": 0.9, "Justification": "clearly algebra" } }""");

            // Run the generate pass.
            var service = new AiTaggingService(gemini.Object);
            await service.SuggestTagsAsync("the statement", "the solution", _candidates, ModelConfig(promptPath));

            // The statement and solution were substituted and the candidate names were sent.
            Assert.Contains("S:the statement", capturedUserPrompt);
            Assert.Contains("X:the solution", capturedUserPrompt);
            Assert.Contains("Algebra", capturedUserPrompt);
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
            { "Algebra": { "GoodnessOfFit": 0.9, "Justification": "clearly algebra" },
              "Made Up Tag": { "GoodnessOfFit": 0.8, "Justification": "not in the vocabulary" } }
            """;

        // Run the generate pass against the stubbed model.
        var result = await RunWithStubbedModelAsync(response,
            (service, promptPath) => service.SuggestTagsAsync("statement", null, _candidates, ModelConfig(promptPath)));

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
            { "Algebra": { "Approved": true, "Reason": "" },
              "Pigeonhole Principle": { "Approved": false, "Reason": "does not apply" } }
            """;

        // Run the veto pass against the stubbed model.
        var approved = await RunWithStubbedModelAsync(response,
            (service, promptPath) => service.VetoTagsAsync("statement", "solution", _candidates, ModelConfig(promptPath)));

        // Only the approved slug survives.
        Assert.Equal(["algebra"], approved);
    }

    /// <summary>
    /// Runs a tagging pass against a model stubbed to return <paramref name="cannedResponse"/>, using a throwaway
    /// prompt template so the service's prompt-file read succeeds.
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
        await File.WriteAllTextAsync(promptPath, "{problem_statement} {problem_solution} {candidate_tags}");

        try
        {
            // A model that always answers with the canned response.
            var gemini = new Mock<IGeminiService>();
            gemini
                .Setup(model => model.GenerateContentAsync(
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(cannedResponse);

            // Run the pass against the configured service.
            return await pass(new AiTaggingService(gemini.Object), promptPath);
        }
        finally
        {
            // Clean up the temp prompt file.
            File.Delete(promptPath);
        }
    }

    /// <summary>
    /// Builds a model config pointing at a prompt file, with the model and budget irrelevant to these tests.
    /// </summary>
    /// <param name="promptPath">The prompt template path.</param>
    /// <returns>A model config for the call.</returns>
    private static AiModelConfig ModelConfig(string promptPath) =>
        new() { Model = "test-model", SystemPromptPath = promptPath, ThinkingBudget = 0 };
}

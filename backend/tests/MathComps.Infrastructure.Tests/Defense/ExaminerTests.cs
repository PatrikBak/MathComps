using MathComps.Infrastructure.Options;
using MathComps.Infrastructure.Services.Ai;
using MathComps.Infrastructure.Services.Defense;
using MathComps.Infrastructure.Services.Defense.Dtos;
using MathComps.Infrastructure.Services.Defense.Engine;
using Moq;
using MsOptions = Microsoft.Extensions.Options.Options;
using ExaminerEngine = MathComps.Infrastructure.Services.Defense.Engine.Examiner;

namespace MathComps.Infrastructure.Tests.Defense;

/// <summary>
/// Tests the examiner loop's guard dispatch through its public entry point with a fake chat caller: both guards run on
/// every reply, a flagged guard triggers regeneration — re-verified each time and capped, so a persistent flaw ships
/// after the cap — a revision carries the specific correction back to the generator, and the turn sums the cost and
/// tokens of every call it made.
/// </summary>
public class ExaminerTests
{
    /// <summary>
    /// The revision cap every test runs the loop under.
    /// </summary>
    private const int RevisionCap = 2;

    /// <summary>
    /// Every turn runs both guards independently: a clean reply is math-checked and leak-checked once each, with
    /// nothing revised.
    /// </summary>
    [Fact]
    public async Task Both_guards_run_on_every_turn()
    {
        // A reply cleared by both guards.
        var caller = new Mock<ILlmChatCaller>();
        SetupTextStep(caller, "a reply.");
        SetupStep(caller, new MathCheckResult(Holds: true, Correction: ""));
        SetupStep(caller, new LeakCheckResult(Leaks: false, WhatLeaked: "", WithholdsClose: false, Established: ""));

        // Run the turn.
        var outcome = await RunAsync(caller);

        // Generate and both guards each ran once; nothing was revised.
        VerifyTextStepCalled(caller, Times.Once());
        VerifyStepCalled<MathCheckResult>(caller, Times.Once());
        VerifyStepCalled<LeakCheckResult>(caller, Times.Once());
        Assert.True(outcome.MathCheck.Holds);
        Assert.False(outcome.LeakCheck.Leaks);
        Assert.Equal(0, outcome.Revisions);
    }

    /// <summary>
    /// A reply written with bracket math delimiters ships in dollars: the generator is free to reach for
    /// <c>\(…\)</c>, and what leaves the loop is what a reader's renderer can display.
    /// </summary>
    [Fact]
    public async Task A_reply_ships_with_its_bracket_math_normalized()
    {
        // A reply whose math is bracket-delimited, cleared by both guards.
        var caller = new Mock<ILlmChatCaller>();
        SetupTextStep(caller, @"Why is \(p^2+1\) not divisible by \[q\]?");
        SetupStep(caller, new MathCheckResult(Holds: true, Correction: ""));
        SetupStep(caller, new LeakCheckResult(Leaks: false, WhatLeaked: "", WithholdsClose: false, Established: ""));

        // Run the turn.
        var outcome = await RunAsync(caller);

        // Both delimiter shapes came out in dollars.
        Assert.Equal("Why is $p^2+1$ not divisible by $$q$$?", outcome.Reply);
    }

    /// <summary>
    /// A failed math-check regenerates the reply, re-verifies the fresh attempt, and stops once the fix holds — the
    /// emitted reply is the regenerated one with a clean verdict and a revision count of one.
    /// </summary>
    [Fact]
    public async Task A_failed_math_check_regenerates_and_re_verifies_until_it_holds()
    {
        // A first reply the math-check rejects, then a regenerated one the loop should emit.
        var caller = new Mock<ILlmChatCaller>();
        caller.SetupSequence(mock => mock.CompleteTextAsync(
                It.IsAny<ChatCallRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result("first reply."))
            .ReturnsAsync(Result("revised reply."));
        caller.SetupSequence(mock => mock.CompleteAsync<MathCheckResult>(
                It.IsAny<ChatCallRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result(new MathCheckResult(Holds: false, Correction: "the bound is at most 1/2, not strictly less")))
            .ReturnsAsync(Result(new MathCheckResult(Holds: true, Correction: "")));
        SetupStep(caller, new LeakCheckResult(Leaks: false, WhatLeaked: "", WithholdsClose: false, Established: ""));

        // Run the turn.
        var outcome = await RunAsync(caller);

        // Generate and math-check each ran twice (the re-verify), the emitted reply is the regenerated one, and it
        // ships with one revision and a now-clean verdict.
        VerifyTextStepCalled(caller, Times.Exactly(2));
        VerifyStepCalled<MathCheckResult>(caller, Times.Exactly(2));
        Assert.Equal(1, outcome.Revisions);
        Assert.Equal("revised reply.", outcome.Reply);
        Assert.True(outcome.MathCheck.Holds);

        // A recovered revision is a normal ship, not the cap's fallback.
        Assert.False(outcome.SafeFallback);
    }

    /// <summary>
    /// A detected leak regenerates the reply and re-verifies it; a clean re-check stops the loop at one revision, with
    /// the math-check running alongside on every attempt.
    /// </summary>
    [Fact]
    public async Task A_detected_leak_regenerates_and_re_verifies_until_clean()
    {
        // A reply the leak-check catches leaking, then clears on the fresh attempt; the math-check stays clean.
        var caller = new Mock<ILlmChatCaller>();
        SetupTextStep(caller, "a reply.");
        SetupStep(caller, new MathCheckResult(Holds: true, Correction: ""));
        caller.SetupSequence(mock => mock.CompleteAsync<LeakCheckResult>(
                It.IsAny<ChatCallRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result(new LeakCheckResult(Leaks: true, WhatLeaked: "named the two-corners counterexample", WithholdsClose: false, Established: "")))
            .ReturnsAsync(Result(new LeakCheckResult(Leaks: false, WhatLeaked: "", WithholdsClose: false, Established: "")));

        // Run the turn.
        var outcome = await RunAsync(caller);

        // Generate, leak-check, and math-check each ran twice; the reply ships clean after one revision.
        VerifyTextStepCalled(caller, Times.Exactly(2));
        VerifyStepCalled<LeakCheckResult>(caller, Times.Exactly(2));
        VerifyStepCalled<MathCheckResult>(caller, Times.Exactly(2));
        Assert.Equal(1, outcome.Revisions);
        Assert.False(outcome.LeakCheck.Leaks);
    }

    /// <summary>
    /// A reply the leak-check keeps flagging burns through the revision cap, then ships the constrained fallback
    /// generated under the safe note instead of the dirty draft — still carrying its flagged verdict, so the trace
    /// shows what happened.
    /// </summary>
    [Fact]
    public async Task A_persistent_leak_ships_the_constrained_fallback_after_the_cap()
    {
        // A reply that always leaks, no matter how many times it's regenerated; the math-check stays clean
        // throughout. Each generate call's request is captured as it lands.
        var generateRequests = new List<ChatCallRequest>();
        var caller = new Mock<ILlmChatCaller>();
        caller.Setup(mock => mock.CompleteTextAsync(
                Capture.In(generateRequests), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result("a reply."));
        SetupStep(caller, new MathCheckResult(Holds: true, Correction: ""));
        SetupStep(caller, new LeakCheckResult(Leaks: true, WhatLeaked: "still gives away the counterexample", WithholdsClose: false, Established: ""));

        // Run the turn.
        var outcome = await RunAsync(caller);

        // Generate ran the initial attempt, the capped revisions, and the fallback on top.
        VerifyTextStepCalled(caller, Times.Exactly(RevisionCap + 2));

        // The fallback shipped, counted like a regeneration and still carrying the flagged verdict.
        Assert.Equal(RevisionCap + 1, outcome.Revisions);
        Assert.True(outcome.SafeFallback);
        Assert.True(outcome.LeakCheck.Leaks);

        // The last generate ran under the safe note, not another correction.
        Assert.Contains("minimal holding reply", generateRequests[^1].SystemPrompt);
    }

    /// <summary>
    /// A reply that keeps pressing a candidate whose solution is already complete regenerates with the close
    /// instruction — the note carries what the candidate established — and the loop stops once the fresh attempt
    /// concedes.
    /// </summary>
    [Fact]
    public async Task A_withheld_close_regenerates_until_the_reply_concedes()
    {
        // Capture each generate call's request as it lands.
        var generateRequests = new List<ChatCallRequest>();
        var caller = new Mock<ILlmChatCaller>();
        caller.SetupSequence(mock => mock.CompleteTextAsync(
                Capture.In(generateRequests), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result("keeps pressing."))
            .ReturnsAsync(Result("conceding reply."));

        // The math stays clean; the leak-check flags the first attempt as withholding an earned close, then clears.
        SetupStep(caller, new MathCheckResult(Holds: true, Correction: ""));
        caller.SetupSequence(mock => mock.CompleteAsync<LeakCheckResult>(
                It.IsAny<ChatCallRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result(new LeakCheckResult(
                Leaks: false, WhatLeaked: "", WithholdsClose: true, Established: "the full divisor-pairing chain")))
            .ReturnsAsync(Result(new LeakCheckResult(
                Leaks: false, WhatLeaked: "", WithholdsClose: false, Established: "")));

        // Run the turn.
        var outcome = await RunAsync(caller);

        // It regenerated exactly once and shipped the conceding reply with a clean verdict.
        Assert.Equal(1, outcome.Revisions);
        Assert.Equal("conceding reply.", outcome.Reply);
        Assert.False(outcome.LeakCheck.WithholdsClose);

        // The regenerate's prompt carried what the candidate established, so the generator knows the exam is over.
        Assert.Contains("the full divisor-pairing chain", generateRequests[1].SystemPrompt);
    }

    /// <summary>
    /// A reply that keeps withholding an earned close burns through the revision cap, then ships the constrained
    /// fallback generated under the closing note instead of the never-closing draft — still carrying its withheld-close
    /// verdict, so the trace shows the exam never got to end.
    /// </summary>
    [Fact]
    public async Task A_persistent_withheld_close_ships_the_constrained_fallback_after_the_cap()
    {
        // A reply that always withholds the close, no matter how many times it's regenerated; the math-check stays
        // clean throughout. Each generate call's request is captured as it lands.
        var generateRequests = new List<ChatCallRequest>();
        var caller = new Mock<ILlmChatCaller>();
        caller.Setup(mock => mock.CompleteTextAsync(
                Capture.In(generateRequests), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result("keeps pressing."));
        SetupStep(caller, new MathCheckResult(Holds: true, Correction: ""));
        SetupStep(caller, new LeakCheckResult(
            Leaks: false, WhatLeaked: "", WithholdsClose: true, Established: "the full divisor-pairing chain"));

        // Run the turn.
        var outcome = await RunAsync(caller);

        // Generate ran the initial attempt, the capped revisions, and the fallback on top.
        VerifyTextStepCalled(caller, Times.Exactly(RevisionCap + 2));

        // The fallback shipped, counted like a regeneration and still carrying the withheld-close verdict.
        Assert.Equal(RevisionCap + 1, outcome.Revisions);
        Assert.True(outcome.SafeFallback);
        Assert.True(outcome.LeakCheck.WithholdsClose);

        // The last generate ran under the closing note — a withheld close is the surviving fault, so the fallback
        // ends the exam instead of retreating to a holding question.
        Assert.Contains("closing reply", generateRequests[^1].SystemPrompt);
    }

    /// <summary>
    /// A reply that trips both guards at once feeds both corrections back into the regeneration: the first attempt
    /// carries no revision note, and the regenerate's prompt names the wrong claim and the leak together.
    /// </summary>
    [Fact]
    public async Task A_reply_tripping_both_guards_feeds_both_corrections_into_the_regeneration()
    {
        // Capture each generate call's request as it lands.
        var generateRequests = new List<ChatCallRequest>();
        var caller = new Mock<ILlmChatCaller>();
        caller.SetupSequence(mock => mock.CompleteTextAsync(
                Capture.In(generateRequests), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result("first reply."))
            .ReturnsAsync(Result("revised reply."));

        // The first attempt fails the math-check and leaks; the regenerate clears both.
        caller.SetupSequence(mock => mock.CompleteAsync<MathCheckResult>(
                It.IsAny<ChatCallRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result(new MathCheckResult(Holds: false, Correction: "the bound is at most 1/2")))
            .ReturnsAsync(Result(new MathCheckResult(Holds: true, Correction: "")));
        caller.SetupSequence(mock => mock.CompleteAsync<LeakCheckResult>(
                It.IsAny<ChatCallRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result(new LeakCheckResult(Leaks: true, WhatLeaked: "named the two-corners counterexample", WithholdsClose: false, Established: "")))
            .ReturnsAsync(Result(new LeakCheckResult(Leaks: false, WhatLeaked: "", WithholdsClose: false, Established: "")));

        // Run the turn.
        var outcome = await RunAsync(caller);

        // It regenerated exactly once, ending clean on both guards.
        Assert.Equal(1, outcome.Revisions);

        // The first generate carried no revision note.
        Assert.Equal(2, generateRequests.Count);
        Assert.DoesNotContain("REVISION REQUIRED", generateRequests[0].SystemPrompt);

        // The regenerate carried both the math correction and the leak, so the generator knows every flaw to fix.
        Assert.Contains("the bound is at most 1/2", generateRequests[1].SystemPrompt);
        Assert.Contains("named the two-corners counterexample", generateRequests[1].SystemPrompt);
    }

    /// <summary>
    /// A literal placeholder token embedded in the problem's own text (e.g. a candidate quoting <c>{reference}</c>
    /// verbatim) survives prompt-filling untouched — it must not be re-expanded into the actual reference solution.
    /// </summary>
    [Fact]
    public async Task A_literal_placeholder_token_in_the_problem_is_not_re_expanded()
    {
        // The problem statement literally quotes "{reference}" — filling must not expand it.
        var problem = "Show that the token {reference} appears verbatim in this statement.";
        var reference = "SECRET-REFERENCE-TEXT";

        // Capture the generate call's request as it lands.
        var generateRequests = new List<ChatCallRequest>();
        var caller = new Mock<ILlmChatCaller>();
        caller.Setup(mock => mock.CompleteTextAsync(
                Capture.In(generateRequests), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result("a reply."));
        SetupStep(caller, new MathCheckResult(Holds: true, Correction: ""));
        SetupStep(caller, new LeakCheckResult(Leaks: false, WhatLeaked: "", WithholdsClose: false, Established: ""));

        // A minimal transcript ending on a candidate turn.
        var transcript = Transcript.Parse("## Candidate\n\nmy defense");

        // Run one turn under throwaway prompt templates against the custom problem and reference.
        await WithTempSettingsAsync(async settings =>
        {
            // Build the examiner over the fake caller.
            var examiner = new ExaminerEngine(caller.Object, MsOptions.Create(settings));

            // Run the turn.
            await examiner.NextReplyAsync(problem, reference, transcript, new ModelUsageAccumulator());

            // The bool is ignored — the captured prompt is what the assertions inspect.
            return true;
        });

        // The literal token inside the problem's own text survives untouched...
        Assert.Contains("the token {reference} appears verbatim", generateRequests[0].SystemPrompt);

        // ...while the template's real {reference} placeholder still got filled with the reference solution.
        Assert.Contains(reference, generateRequests[0].SystemPrompt);
    }

    /// <summary>
    /// The turn's outcome sums the cost and tokens of every model call it made — the generate step and both guards on a
    /// clean turn — so a caller can price the turn from a single figure.
    /// </summary>
    [Fact]
    public async Task Turn_sums_cost_and_tokens_across_all_calls()
    {
        // Each of the three calls a clean turn makes reports its own cost and token usage.
        var caller = new Mock<ILlmChatCaller>();
        SetupTextStep(caller, "a reply.", cost: 0.01m, promptTokens: 100, completionTokens: 20);
        SetupStep(caller, new MathCheckResult(Holds: true, Correction: ""), cost: 0.02m, promptTokens: 200, completionTokens: 30);
        SetupStep(caller, new LeakCheckResult(Leaks: false, WhatLeaked: "", WithholdsClose: false, Established: ""), cost: 0.03m, promptTokens: 300, completionTokens: 40);

        // Run the turn.
        var outcome = await RunAsync(caller);

        // The outcome carries the summed spend and tokens of all three calls.
        Assert.Equal(0.06m, outcome.Usage.Cost);
        Assert.Equal(600, outcome.Usage.PromptTokens);
        Assert.Equal(90, outcome.Usage.CompletionTokens);
    }

    /// <summary>
    /// The loop refuses a transcript whose last turn isn't the candidate's — there's nothing to reply to.
    /// </summary>
    [Fact]
    public async Task Loop_refuses_a_transcript_not_awaiting_the_examiner()
    {
        // A strict caller — the loop must reject the transcript before any model call.
        var caller = new Mock<ILlmChatCaller>(MockBehavior.Strict);

        // A transcript that ends on an examiner turn.
        var transcript = Transcript.Parse("## Candidate\n\ndefense\n\n## Examiner\n\nquestion");

        // Under throwaway settings, run the loop against it.
        await WithTempSettingsAsync(async settings =>
        {
            // Build the examiner over the strict caller.
            var examiner = new ExaminerEngine(caller.Object, MsOptions.Create(settings));

            // It throws instead of calling the model.
            await Assert.ThrowsAsync<InvalidOperationException>(
                () => examiner.NextReplyAsync("problem", "reference", transcript, new ModelUsageAccumulator()));

            // The bool is ignored — the assertion is the point.
            return true;
        });
    }

    /// <summary>
    /// Runs one turn of the loop against the fake caller over a minimal conversation awaiting the examiner, wiring the
    /// loop to throwaway prompt templates.
    /// </summary>
    /// <param name="caller">The fake chat caller with its steps set up.</param>
    /// <returns>The turn's outcome.</returns>
    private static async Task<ExaminerTurnOutcome> RunAsync(Mock<ILlmChatCaller> caller)
    {
        // A minimal transcript ending on a candidate turn.
        var transcript = Transcript.Parse("## Candidate\n\nmy defense");

        // Run the loop under throwaway prompt templates and hand back its outcome.
        return await WithTempSettingsAsync(settings =>
            new ExaminerEngine(caller.Object, MsOptions.Create(settings))
                .NextReplyAsync("problem", "reference", transcript, new ModelUsageAccumulator()));
    }

    /// <summary>
    /// Writes throwaway prompt templates to a temp folder, builds settings pointing at them, runs the body, and cleans
    /// up — the loop reads each step's prompt file before calling the model, so the files must exist.
    /// </summary>
    /// <typeparam name="T">The body's result type.</typeparam>
    /// <param name="body">The work to run against the built settings.</param>
    /// <returns>The body's result.</returns>
    private static async Task<T> WithTempSettingsAsync<T>(Func<ExaminerSettings, Task<T>> body)
    {
        // A temp folder to hold the throwaway prompt files.
        var directory = Directory.CreateTempSubdirectory("examiner-loop-tests");

        // Build settings over those prompts, cleaning the folder up after.
        try
        {
            // Write one placeholder prompt per step and point a step's settings at it.
            ChatStepSettings Step(string name)
            {
                var path = Path.Combine(directory.FullName, name);
                File.WriteAllText(path, "{problem} {reference} {revision_note}");
                return new ChatStepSettings { Prompt = path, Model = "test-model" };
            }

            // Settings wired to the throwaway prompts.
            var settings = new ExaminerSettings
            {
                Generate = Step("generate.txt"),
                MathCheck = Step("math-check.txt"),
                LeakCheck = Step("leak-check.txt"),
                MaxRevisions = RevisionCap,
            };

            // Run the body against them.
            return await body(settings);
        }
        finally
        {
            // Drop the temp prompt files.
            directory.Delete(recursive: true);
        }
    }

    /// <summary>
    /// Wraps a value in a chat-call result carrying the given cost and tokens, the shape a caller hands back.
    /// </summary>
    /// <typeparam name="TResponse">The shape the reply is read into.</typeparam>
    /// <param name="value">The reply.</param>
    /// <param name="cost">The cost the call reports.</param>
    /// <param name="promptTokens">The prompt tokens the call reports.</param>
    /// <param name="completionTokens">The completion tokens the call reports.</param>
    /// <returns>The wrapped result.</returns>
    private static ChatCallResult<TResponse> Result<TResponse>(
        TResponse value, decimal cost = 0m, int promptTokens = 0, int completionTokens = 0) =>
        new(value, new ModelUsage(cost, promptTokens, completionTokens, ReasoningTokens: 0, CachedPromptTokens: 0));

    /// <summary>
    /// Sets the fake caller to answer any call binding to <typeparamref name="TResponse"/> with the given response,
    /// carrying the given cost and tokens.
    /// </summary>
    /// <typeparam name="TResponse">The response type the step binds into.</typeparam>
    /// <param name="caller">The fake caller to configure.</param>
    /// <param name="response">The response it should return.</param>
    /// <param name="cost">The cost the call reports.</param>
    /// <param name="promptTokens">The prompt tokens the call reports.</param>
    /// <param name="completionTokens">The completion tokens the call reports.</param>
    private static void SetupStep<TResponse>(
        Mock<ILlmChatCaller> caller, TResponse response,
        decimal cost = 0m, int promptTokens = 0, int completionTokens = 0) =>
        caller.Setup(mock => mock.CompleteAsync<TResponse>(
                It.IsAny<ChatCallRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result(response, cost, promptTokens, completionTokens));

    /// <summary>
    /// Asserts how many times the fake caller was asked for a completion binding to <typeparamref name="TResponse"/>.
    /// </summary>
    /// <typeparam name="TResponse">The response type the step binds into.</typeparam>
    /// <param name="caller">The fake caller to check.</param>
    /// <param name="times">The expected number of calls.</param>
    private static void VerifyStepCalled<TResponse>(Mock<ILlmChatCaller> caller, Times times) =>
        caller.Verify(mock => mock.CompleteAsync<TResponse>(
                It.IsAny<ChatCallRequest>(), It.IsAny<CancellationToken>()), times);

    /// <summary>
    /// Sets the fake caller to answer any plain-text call — the generate step — with the given reply, carrying the
    /// given cost and tokens.
    /// </summary>
    /// <param name="caller">The fake caller to configure.</param>
    /// <param name="reply">The reply text it should return.</param>
    /// <param name="cost">The cost the call reports.</param>
    /// <param name="promptTokens">The prompt tokens the call reports.</param>
    /// <param name="completionTokens">The completion tokens the call reports.</param>
    private static void SetupTextStep(
        Mock<ILlmChatCaller> caller, string reply,
        decimal cost = 0m, int promptTokens = 0, int completionTokens = 0) =>
        caller.Setup(mock => mock.CompleteTextAsync(
                It.IsAny<ChatCallRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result(reply, cost, promptTokens, completionTokens));

    /// <summary>
    /// Asserts how many times the fake caller was asked for a plain-text completion — the generate step.
    /// </summary>
    /// <param name="caller">The fake caller to check.</param>
    /// <param name="times">The expected number of calls.</param>
    private static void VerifyTextStepCalled(Mock<ILlmChatCaller> caller, Times times) =>
        caller.Verify(mock => mock.CompleteTextAsync(
                It.IsAny<ChatCallRequest>(), It.IsAny<CancellationToken>()), times);
}

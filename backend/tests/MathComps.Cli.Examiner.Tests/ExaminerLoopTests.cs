using MathComps.Cli.Examiner.Dtos;
using MathComps.Cli.Examiner.Engine;
using MathComps.Cli.Examiner.Fixtures;
using MathComps.Cli.Examiner.Settings;
using MathComps.Infrastructure.Options;
using MathComps.Infrastructure.Services.Ai;
using Microsoft.Extensions.Options;
using Moq;
using ExaminerEngine = MathComps.Cli.Examiner.Engine.Examiner;

namespace MathComps.Cli.Examiner.Tests;

/// <summary>
/// Tests the examiner loop's guard dispatch through its public entry point with a fake chat caller: both guards run on
/// every reply, a flagged guard triggers regeneration — re-verified each time and capped, so a persistent flaw ships
/// after the cap — and a revision carries the specific correction back to the generator.
/// </summary>
public class ExaminerLoopTests
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
        var caller = new Mock<IOpenRouterChatCaller>();
        SetupStep(caller, "a reply.");
        SetupStep(caller, new MathCheckResult(Holds: true, Correction: ""));
        SetupStep(caller, new LeakCheckResult(Leaks: false, WhatLeaked: ""));

        // Run the turn.
        var outcome = await RunAsync(caller);

        // Generate and both guards each ran once; nothing was revised.
        VerifyStepCalled<string>(caller, Times.Once());
        VerifyStepCalled<MathCheckResult>(caller, Times.Once());
        VerifyStepCalled<LeakCheckResult>(caller, Times.Once());
        Assert.True(outcome.MathCheck.Holds);
        Assert.False(outcome.LeakCheck.Leaks);
        Assert.Equal(0, outcome.Revisions);
    }

    /// <summary>
    /// A failed math-check regenerates the reply, re-verifies the fresh attempt, and stops once the fix holds — the
    /// emitted reply is the regenerated one with a clean verdict and a revision count of one.
    /// </summary>
    [Fact]
    public async Task A_failed_math_check_regenerates_and_re_verifies_until_it_holds()
    {
        // A first reply the math-check rejects, then a regenerated one the loop should emit.
        var caller = new Mock<IOpenRouterChatCaller>();
        caller.SetupSequence(mock => mock.CompleteAsync<string>(
                It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<int?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync("first reply.")
            .ReturnsAsync("revised reply.");
        caller.SetupSequence(mock => mock.CompleteAsync<MathCheckResult>(
                It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<int?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new MathCheckResult(Holds: false, Correction: "the bound is at most 1/2, not strictly less"))
            .ReturnsAsync(new MathCheckResult(Holds: true, Correction: ""));
        SetupStep(caller, new LeakCheckResult(Leaks: false, WhatLeaked: ""));

        // Run the turn.
        var outcome = await RunAsync(caller);

        // Generate and math-check each ran twice (the re-verify), the emitted reply is the regenerated one, and it
        // ships with one revision and a now-clean verdict.
        VerifyStepCalled<string>(caller, Times.Exactly(2));
        VerifyStepCalled<MathCheckResult>(caller, Times.Exactly(2));
        Assert.Equal(1, outcome.Revisions);
        Assert.Equal("revised reply.", outcome.Reply);
        Assert.True(outcome.MathCheck.Holds);
    }

    /// <summary>
    /// A detected leak regenerates the reply and re-verifies it; a clean re-check stops the loop at one revision, with
    /// the math-check running alongside on every attempt.
    /// </summary>
    [Fact]
    public async Task A_detected_leak_regenerates_and_re_verifies_until_clean()
    {
        // A reply the leak-check catches leaking, then clears on the fresh attempt; the math-check stays clean.
        var caller = new Mock<IOpenRouterChatCaller>();
        SetupStep(caller, "a reply.");
        SetupStep(caller, new MathCheckResult(Holds: true, Correction: ""));
        caller.SetupSequence(mock => mock.CompleteAsync<LeakCheckResult>(
                It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<int?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new LeakCheckResult(Leaks: true, WhatLeaked: "named the two-corners counterexample"))
            .ReturnsAsync(new LeakCheckResult(Leaks: false, WhatLeaked: ""));

        // Run the turn.
        var outcome = await RunAsync(caller);

        // Generate, leak-check, and math-check each ran twice; the reply ships clean after one revision.
        VerifyStepCalled<string>(caller, Times.Exactly(2));
        VerifyStepCalled<LeakCheckResult>(caller, Times.Exactly(2));
        VerifyStepCalled<MathCheckResult>(caller, Times.Exactly(2));
        Assert.Equal(1, outcome.Revisions);
        Assert.False(outcome.LeakCheck.Leaks);
    }

    /// <summary>
    /// A reply the leak-check keeps flagging is regenerated up to the cap, then ships regardless — carrying the still-
    /// failing verdict and a revision count equal to the cap, so a stubborn leak can't loop forever.
    /// </summary>
    [Fact]
    public async Task A_persistent_leak_ships_after_the_revision_cap()
    {
        // A reply that always leaks, no matter how many times it's regenerated; the math-check stays clean throughout.
        var caller = new Mock<IOpenRouterChatCaller>();
        SetupStep(caller, "a reply.");
        SetupStep(caller, new MathCheckResult(Holds: true, Correction: ""));
        SetupStep(caller, new LeakCheckResult(Leaks: true, WhatLeaked: "still gives away the counterexample"));

        // Run the turn.
        var outcome = await RunAsync(caller);

        // Generate ran the initial attempt plus the capped revisions, then shipped the still-leaking reply.
        VerifyStepCalled<string>(caller, Times.Exactly(RevisionCap + 1));
        Assert.Equal(RevisionCap, outcome.Revisions);
        Assert.True(outcome.LeakCheck.Leaks);
    }

    /// <summary>
    /// A reply that trips both guards at once feeds both corrections back into the regeneration: the first attempt
    /// carries no revision note, and the regenerate's prompt names the wrong claim and the leak together.
    /// </summary>
    [Fact]
    public async Task A_reply_tripping_both_guards_feeds_both_corrections_into_the_regeneration()
    {
        // Capture each generate call's system prompt as it lands.
        var generatePrompts = new List<string>();
        var caller = new Mock<IOpenRouterChatCaller>();
        caller.SetupSequence(mock => mock.CompleteAsync<string>(
                Capture.In(generatePrompts), It.IsAny<string>(),
                It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<int?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync("first reply.")
            .ReturnsAsync("revised reply.");

        // The first attempt fails the math-check and leaks; the regenerate clears both.
        caller.SetupSequence(mock => mock.CompleteAsync<MathCheckResult>(
                It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<int?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new MathCheckResult(Holds: false, Correction: "the bound is at most 1/2"))
            .ReturnsAsync(new MathCheckResult(Holds: true, Correction: ""));
        caller.SetupSequence(mock => mock.CompleteAsync<LeakCheckResult>(
                It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<int?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new LeakCheckResult(Leaks: true, WhatLeaked: "named the two-corners counterexample"))
            .ReturnsAsync(new LeakCheckResult(Leaks: false, WhatLeaked: ""));

        // Run the turn.
        var outcome = await RunAsync(caller);

        // It regenerated exactly once, ending clean on both guards.
        Assert.Equal(1, outcome.Revisions);

        // The first generate carried no revision note.
        Assert.Equal(2, generatePrompts.Count);
        Assert.DoesNotContain("REVISION REQUIRED", generatePrompts[0]);

        // The regenerate carried both the math correction and the leak, so the generator knows every flaw to fix.
        Assert.Contains("the bound is at most 1/2", generatePrompts[1]);
        Assert.Contains("named the two-corners counterexample", generatePrompts[1]);
    }

    /// <summary>
    /// The loop refuses a transcript whose last turn isn't the candidate's — there's nothing to reply to.
    /// </summary>
    [Fact]
    public async Task Loop_refuses_a_transcript_not_awaiting_the_examiner()
    {
        // A strict caller — the loop must reject the transcript before any model call.
        var caller = new Mock<IOpenRouterChatCaller>(MockBehavior.Strict);

        // A transcript that ends on an examiner turn.
        var fixture = new Fixture(
            "problem", "reference",
            Transcript.Parse("## Candidate\n\ndefense\n\n## Examiner\n\nquestion"));

        // Under throwaway settings, run the loop against it.
        await WithTempSettingsAsync(async settings =>
        {
            // Build the examiner over the strict caller.
            var examiner = new ExaminerEngine(caller.Object, Options.Create(settings));

            // It throws instead of calling the model.
            await Assert.ThrowsAsync<InvalidOperationException>(() => examiner.NextReplyAsync(fixture));

            // The bool is ignored — the assertion is the point.
            return true;
        });
    }

    /// <summary>
    /// Runs one turn of the loop against the fake caller over a minimal fixture awaiting the examiner, wiring the loop
    /// to throwaway prompt templates.
    /// </summary>
    /// <param name="caller">The fake chat caller with its steps set up.</param>
    /// <returns>The turn's outcome.</returns>
    private static async Task<ExaminerTurnOutcome> RunAsync(Mock<IOpenRouterChatCaller> caller)
    {
        // A minimal fixture whose transcript ends on a candidate turn.
        var fixture = new Fixture("problem", "reference", Transcript.Parse("## Candidate\n\nmy defense"));

        // Run the loop under throwaway prompt templates and hand back its outcome.
        return await WithTempSettingsAsync(
            settings => new ExaminerEngine(caller.Object, Options.Create(settings)).NextReplyAsync(fixture));
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
    /// Sets the fake caller to answer any call binding to <typeparamref name="TResponse"/> with the given response.
    /// </summary>
    /// <typeparam name="TResponse">The response type the step binds into.</typeparam>
    /// <param name="caller">The fake caller to configure.</param>
    /// <param name="response">The response it should return.</param>
    private static void SetupStep<TResponse>(Mock<IOpenRouterChatCaller> caller, TResponse response) =>
        caller.Setup(mock => mock.CompleteAsync<TResponse>(
                It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<int?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(response);

    /// <summary>
    /// Asserts how many times the fake caller was asked for a completion binding to <typeparamref name="TResponse"/>.
    /// </summary>
    /// <typeparam name="TResponse">The response type the step binds into.</typeparam>
    /// <param name="caller">The fake caller to check.</param>
    /// <param name="times">The expected number of calls.</param>
    private static void VerifyStepCalled<TResponse>(Mock<IOpenRouterChatCaller> caller, Times times) =>
        caller.Verify(mock => mock.CompleteAsync<TResponse>(
                It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<int?>(), It.IsAny<CancellationToken>()), times);
}

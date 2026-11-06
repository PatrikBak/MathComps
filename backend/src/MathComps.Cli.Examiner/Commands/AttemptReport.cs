using MathComps.Infrastructure.Services.Defense.Dtos;
using MathComps.Infrastructure.Services.Defense.Engine;
using Microsoft.Extensions.Logging;

namespace MathComps.Cli.Examiner.Commands;

/// <summary>
/// Logs one judged attempt: the model calls behind it and every guard's verdict on its reply.
/// </summary>
public static class AttemptReport
{
    /// <summary>
    /// Logs one line per model call the attempt made: the step, how it was routed, what it billed, and what it kept
    /// the attempt waiting.
    /// </summary>
    /// <param name="logger">The logger the lines go through.</param>
    /// <param name="attempt">The attempt whose calls to list.</param>
    public static void RenderCalls(ILogger logger, ExaminerAttempt attempt)
    {
        // Walk the calls in the order they were started.
        foreach (var call in attempt.Calls)
        {
            // The reasoning level, or a marker for a call that sent no reasoning field at all.
            var effort = call.ReasoningEffort ?? "default";

            // One line for the call, its token counts calling out the reasoning ones since a level change moves them.
            logger.LogInformation(
                "  {Step} — {Model}, reasoning {Effort}, ${Cost:0.00000}, " +
                "{PromptTokens} in, {CompletionTokens} out ({ReasoningTokens} reasoning), {Seconds:0.0}s",
                call.Step, call.Model, effort, call.Usage.Cost, call.Usage.PromptTokens, call.Usage.CompletionTokens,
                call.Usage.ReasoningTokens, TimeSpan.FromMilliseconds(call.DurationMs).TotalSeconds);
        }
    }

    /// <summary>
    /// Logs every guard's verdict on the attempt's reply, a flagged one as a warning.
    /// </summary>
    /// <param name="logger">The logger the lines go through.</param>
    /// <param name="attempt">The attempt whose verdicts to log.</param>
    public static void RenderVerdicts(ILogger logger, ExaminerAttempt attempt)
    {
        // The math-check line: holds, or fails with the correction.
        RenderMathCheck(logger, attempt.MathCheck);

        // The completeness line: whether the solution is done, and whether the reply ended in step with it.
        RenderCompleteness(logger, attempt.MathCheck);

        // The leak-check line: clean, or a leak with what leaked.
        RenderLeakCheck(logger, attempt.LeakCheck);

        // The language-check lines: the candidate's language, or each flag the reply raised against it.
        RenderLanguageCheck(logger, attempt.LanguageCheck);

        // The route-check line: no takeover, or a takeover with the reference step the question fishes for.
        RenderRouteCheck(logger, attempt.RouteCheck);
    }

    /// <summary>
    /// Logs the math-check line: a pass when every claim held, or a fail carrying the correction.
    /// </summary>
    /// <param name="logger">The logger the line goes through.</param>
    /// <param name="mathCheck">The math-check verdict.</param>
    private static void RenderMathCheck(ILogger logger, MathCheckResult mathCheck)
    {
        // Passed: every claim held.
        if (mathCheck.Holds)
        {
            // Log the pass.
            logger.LogInformation("Math-check: holds");

            // A pass has no correction to show.
            return;
        }

        // Failed: surface the correction.
        logger.LogWarning("Math-check: fails — {Correction}", mathCheck.Correction);
    }

    /// <summary>
    /// Logs the math-check's completeness line: an ending that came before the solution was complete, which is a
    /// flaw; a reply that kept going after it was, which ships as drafted; otherwise whether the solution is done and
    /// what it still owes.
    /// </summary>
    /// <param name="logger">The logger the line goes through.</param>
    /// <param name="mathCheck">The math-check verdict.</param>
    private static void RenderCompleteness(ILogger logger, MathCheckResult mathCheck)
    {
        // Ended while a step is still owed: surface what.
        if (mathCheck.ClosesEarly)
        {
            // Log the early close with what is still owed.
            logger.LogWarning("Completeness: closes early — still owed: {Owed}", mathCheck.Owed);

            // The early close is the whole verdict.
            return;
        }

        // Kept going on a solution that is already complete, which the engine lets through.
        if (mathCheck.WithholdsClose)
        {
            // Log the withheld close.
            logger.LogInformation("Completeness: withholds the close — the solution is complete");

            // The withheld close is the whole verdict.
            return;
        }

        // Ended on a complete solution.
        if (mathCheck.Complete)
        {
            // Log the complete solution.
            logger.LogInformation("Completeness: complete, and the reply ends");

            // Nothing is owed on a complete solution.
            return;
        }

        // Still open and the reply goes on: name what is owed.
        logger.LogInformation("Completeness: still open — owed: {Owed}", mathCheck.Owed);
    }

    /// <summary>
    /// Logs the leak-check line: clean when the reply hands over nothing unearned, or a leak carrying what was given
    /// away.
    /// </summary>
    /// <param name="logger">The logger the line goes through.</param>
    /// <param name="leakCheck">The leak-check verdict on the reply.</param>
    private static void RenderLeakCheck(ILogger logger, LeakCheckResult leakCheck)
    {
        // Clean: nothing given away.
        if (!leakCheck.Leaks)
        {
            // Log the clean verdict.
            logger.LogInformation("Leak-check: clean");

            // A clean reply gave nothing away to show.
            return;
        }

        // Leaking: surface what was given away.
        logger.LogWarning("Leak-check: leaks — {WhatLeaked}", leakCheck.WhatLeaked);
    }

    /// <summary>
    /// Logs the language-check lines: the language the candidate wrote in, whether the reply drifted out of it, and
    /// whether its wording assumes the candidate's gender.
    /// </summary>
    /// <param name="logger">The logger the lines go through.</param>
    /// <param name="languageCheck">The language-check verdict on the reply.</param>
    private static void RenderLanguageCheck(ILogger logger, LanguageCheckResult languageCheck)
    {
        // The language the candidate wrote in.
        var language = languageCheck.CandidateLanguage;

        // Drifted: the reply landed in some other language than the candidate's.
        if (languageCheck.SwitchesLanguage)
            logger.LogWarning("Language-check: switched — the candidate wrote in {Language}", language);

        // Guessed who it is talking to, in whatever language it landed in.
        if (languageCheck.GendersTheReader)
            logger.LogWarning("Language-check: genders the reader — the candidate wrote in {Language}", language);

        // Clear on both counts: name the language the reply stayed in.
        if (languageCheck is { SwitchesLanguage: false, GendersTheReader: false })
            logger.LogInformation("Language-check: {Language}", language);
    }

    /// <summary>
    /// Logs the route-check line: no takeover, or a takeover with the reference step the question fishes for.
    /// </summary>
    /// <param name="logger">The logger the line goes through.</param>
    /// <param name="routeCheck">The route-check verdict on the reply.</param>
    private static void RenderRouteCheck(ILogger logger, RouteCheckResult routeCheck)
    {
        // Taken over: the question keeps nothing of the candidate's route, and its answer is a line of the reference.
        if (routeCheck.TakesOver)
        {
            // Log the takeover with the reference step it fishes for.
            logger.LogWarning("Route-check: takes over — fishes for: {Restates}", routeCheck.Restates);

            // A takeover is the whole verdict.
            return;
        }

        // Held: the reply stayed on the candidate's route.
        logger.LogInformation("Route-check: no takeover");
    }
}

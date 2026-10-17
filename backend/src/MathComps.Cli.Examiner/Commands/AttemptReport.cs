using MathComps.Infrastructure.Services.Defense.Dtos;
using MathComps.Infrastructure.Services.Defense.Engine;
using Spectre.Console;

namespace MathComps.Cli.Examiner.Commands;

/// <summary>
/// Writes one judged attempt to the console: the model calls behind it and every guard's verdict on its reply.
/// </summary>
public static class AttemptReport
{
    /// <summary>
    /// Writes one line per model call the attempt made: the step, how it was routed, what it billed, and what it kept
    /// the attempt waiting.
    /// </summary>
    /// <param name="attempt">The attempt whose calls to list.</param>
    public static void RenderCalls(ExaminerAttempt attempt)
    {
        // Walk the calls in the order they were started.
        foreach (var call in attempt.Calls)
        {
            // The reasoning level, or a marker for a call that sent no reasoning field at all.
            var effort = call.ReasoningEffort ?? "default";

            // The counts, with the reasoning ones called out since they're what a level change moves, and how long the
            // call took.
            var spent =
                $"{call.Usage.PromptTokens} in, {call.Usage.CompletionTokens} out " +
                $"({call.Usage.ReasoningTokens} reasoning), {call.DurationMs / 1000.0:0.0}s";

            // The call's line.
            AnsiConsole.MarkupLineInterpolated(
                $"[grey]  {call.Step} — {call.Model}, reasoning {effort}, ${call.Usage.Cost:0.00000}, {spent}[/]");
        }
    }

    /// <summary>
    /// Writes one line per guard with its verdict on the attempt's reply.
    /// </summary>
    /// <param name="attempt">The attempt whose verdicts to write.</param>
    public static void RenderVerdicts(ExaminerAttempt attempt)
    {
        // The math-check line: holds, or fails with the correction.
        RenderMathCheck(attempt.MathCheck);

        // The completeness line: whether the solution is done, and whether the reply ended in step with it.
        RenderCompleteness(attempt.MathCheck);

        // The leak-check line: clean, or a leak with what leaked.
        RenderLeakCheck(attempt.LeakCheck);

        // The language-check lines: the candidate's language, or each flag the reply raised against it.
        RenderLanguageCheck(attempt.LanguageCheck);

        // The route verdict and any reference step the question asks for.
        RenderRouteCheck(attempt.RouteCheck);
    }

    /// <summary>
    /// Renders the math-check line: a pass when every claim held, or a fail carrying the correction.
    /// </summary>
    /// <param name="mathCheck">The math-check verdict.</param>
    private static void RenderMathCheck(MathCheckResult mathCheck)
    {
        // Passed — every claim held.
        if (mathCheck.Holds)
        {
            AnsiConsole.MarkupLine("[green]Math-check:[/] holds");
            return;
        }

        // Failed — surface the correction.
        AnsiConsole.MarkupLineInterpolated($"[red]Math-check:[/] fails — {mathCheck.Correction}");
    }

    /// <summary>
    /// Renders the math-check's completeness line: an ending that came before the solution was complete, which is a
    /// flaw; a reply that kept going after it was, which ships as drafted; otherwise whether the solution is done and
    /// what it still owes.
    /// </summary>
    /// <param name="mathCheck">The math-check verdict.</param>
    private static void RenderCompleteness(MathCheckResult mathCheck)
    {
        // Ended while a step is still owed — surface what.
        if (mathCheck.ClosesEarly)
        {
            AnsiConsole.MarkupLineInterpolated($"[red]Completeness:[/] closes early — still owed: {mathCheck.Owed}");
            return;
        }

        // Kept going on a solution that is already complete, which the engine lets through.
        if (mathCheck.WithholdsClose)
        {
            AnsiConsole.MarkupLine("[yellow]Completeness:[/] withholds the close — the solution is complete");
            return;
        }

        // Ended on a complete solution.
        if (mathCheck.Complete)
        {
            AnsiConsole.MarkupLine("[green]Completeness:[/] complete, and the reply ends");
            return;
        }

        // Still open and the reply goes on — name what is owed.
        AnsiConsole.MarkupLineInterpolated($"[green]Completeness:[/] still open — owed: {mathCheck.Owed}");
    }

    /// <summary>
    /// Renders the leak-check line: clean when the reply hands over nothing unearned, or a leak carrying what was
    /// given away.
    /// </summary>
    /// <param name="leakCheck">The leak-check verdict on the reply.</param>
    private static void RenderLeakCheck(LeakCheckResult leakCheck)
    {
        // Clean — nothing given away.
        if (!leakCheck.Leaks)
        {
            AnsiConsole.MarkupLine("[green]Leak-check:[/] clean");
            return;
        }

        // Leaking — surface what was given away.
        AnsiConsole.MarkupLineInterpolated($"[red]Leak-check:[/] leaks — {leakCheck.WhatLeaked}");
    }

    /// <summary>
    /// Renders the language-check lines: the language the candidate wrote in, whether the reply drifted out of it, and
    /// whether its wording assumes the candidate's gender.
    /// </summary>
    /// <param name="languageCheck">The language-check verdict on the reply.</param>
    private static void RenderLanguageCheck(LanguageCheckResult languageCheck)
    {
        // The language the candidate wrote in.
        var language = languageCheck.CandidateLanguage;

        // Drifted — the reply landed in some other language than the candidate's.
        if (languageCheck.SwitchesLanguage)
            AnsiConsole.MarkupLineInterpolated($"[red]Language-check:[/] switched — the candidate wrote in {language}");

        // Guessed who it is talking to, in whatever language it landed in.
        if (languageCheck.GendersTheReader)
            AnsiConsole.MarkupLineInterpolated(
                $"[red]Language-check:[/] genders the reader — the candidate wrote in {language}");

        // Clear on both counts — name the language it stayed in.
        if (languageCheck is { SwitchesLanguage: false, GendersTheReader: false })
            AnsiConsole.MarkupLineInterpolated($"[green]Language-check:[/] {language}");
    }

    /// <summary>
    /// Renders the route verdict and any reference step the question asks for.
    /// </summary>
    /// <param name="routeCheck">The route-check verdict on the reply.</param>
    private static void RenderRouteCheck(RouteCheckResult routeCheck)
    {
        // Taken over — the question kept nothing of theirs and its answer is a line of the reference.
        if (routeCheck.TakesOver)
        {
            AnsiConsole.MarkupLineInterpolated(
                $"[red]Route-check:[/] takes over — fishes for: {routeCheck.Restates}");
            return;
        }

        // Held — say the reply stayed on the candidate's route.
        AnsiConsole.MarkupLine("[green]Route-check:[/] no takeover");
    }
}

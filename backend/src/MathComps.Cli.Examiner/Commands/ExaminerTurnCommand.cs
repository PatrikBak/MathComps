using System.ComponentModel;
using System.Diagnostics;
using MathComps.Cli.Examiner.Fixtures;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Services.Ai;
using MathComps.Infrastructure.Services.Defense.Engine;
using Spectre.Console;
using Spectre.Console.Cli;

namespace MathComps.Cli.Examiner.Commands;

/// <summary>
/// Produces the examiner's next reply for one fixture and appends it to the transcript in place. It loads the fixture
/// (problem, reference, transcript), runs the generate → verify → revise loop, writes the reply as a
/// <c>## Examiner</c> turn, and reports what the loop did and what the turn cost.
/// </summary>
/// <param name="examiner">The engine that runs the per-turn loop.</param>
[Description("""
    Produce the examiner's next reply for a fixture folder and append it to transcript.md. The fixture's problem,
    reference, and transcript feed the loop; the reply is math-checked, leak-checked, language-checked and
    route-checked, and regenerated up to a cap if a check flags it. The transcript's last turn must be a
    '## Candidate' turn — the examiner replies to the candidate.
""")]
public class ExaminerTurnCommand(IExaminer examiner)
    : AsyncCommand<ExaminerTurnCommand.Settings>
{
    /// <summary>
    /// The command arguments.
    /// </summary>
    public class Settings : CommandSettings
    {
        /// <summary>
        /// The fixture folder to reply to.
        /// </summary>
        [CommandArgument(0, "<fixture>")]
        [Description("Path to the fixture folder to produce the examiner's next reply for.")]
        public required string Fixture { get; set; }
    }

    /// <inheritdoc/>
    public override async Task<int> ExecuteAsync(CommandContext context, Settings commandSettings)
    {
        // The fixture folder to reply to.
        var folder = commandSettings.Fixture;

        // Bail early when it isn't there.
        if (!Directory.Exists(folder))
        {
            AnsiConsole.MarkupLineInterpolated($"[red]Fixture folder not found:[/] {folder}");
            return 1;
        }

        // Load the fixture — problem, reference, transcript.
        var fixture = await Fixture.LoadAsync(folder);

        // Time the model work.
        var stopwatch = Stopwatch.StartNew();

        // Run the loop to produce the next reply.
        var outcome = await examiner.NextReplyAsync(fixture, new ModelUsageAccumulator());

        // Stop the clock before the follow-up I/O.
        stopwatch.Stop();

        // Append the reply so the next candidate turn builds on it.
        var updated = fixture.Transcript.Append(TranscriptRole.Examiner, outcome.Shipped.Reply);

        // Write the transcript back, keeping a trailing newline on the file.
        await File.WriteAllTextAsync(Path.Combine(folder, "transcript.md"), updated.ToMarkdown() + "\n");

        // Report what the loop did.
        Render(outcome, stopwatch.Elapsed);

        // Price the turn from the outcome's own tally; one credit is one US dollar.
        AnsiConsole.MarkupLine($"[green]This turn cost ${outcome.Usage.Cost:0.0000}.[/]");

        // Done.
        return 0;
    }

    /// <summary>
    /// Writes the full report to the console.
    /// </summary>
    /// <param name="outcome">The turn's reply and loop trace.</param>
    /// <param name="elapsed">How long the model work took.</param>
    private static void Render(ExaminerTurnOutcome outcome, TimeSpan elapsed)
    {
        // What each step of each attempt cost, which the turn's own total can't break down.
        RenderCallTrail(outcome);

        // Header for the reply.
        AnsiConsole.MarkupLine("\n[bold]Examiner reply[/]");

        // The reply itself — printed plainly since it's arbitrary model text, not markup.
        AnsiConsole.WriteLine(outcome.Shipped.Reply);

        // Every guard's verdict on the shipped reply.
        AttemptReport.RenderVerdicts(outcome.Shipped);

        // How many times a flagged check forced a regeneration.
        AnsiConsole.MarkupLine(outcome.Revisions == 0
            ? "[green]Revised:[/] no"
            : $"[yellow]Revised:[/] {outcome.Revisions}×");

        // Whether the shipped reply is the constrained fallback after every attempt stayed flagged.
        if (outcome.SafeFallback)
            AnsiConsole.MarkupLine("[yellow]Safe fallback shipped — the revision cap ran out still flagged.[/]");

        // How long the whole turn took.
        AnsiConsole.MarkupLineInterpolated($"[grey]Turn took {elapsed.TotalSeconds:0.0}s.[/]");
    }

    /// <summary>
    /// Writes what each attempt's calls cost and how long they took, one line per call. A turn reports a single figure
    /// of each, which is what the spend ceiling charges against and useless for tuning a step: this is the breakdown a
    /// reasoning-level or model change is judged on, and on a revised turn it also shows what the rejected drafts were
    /// spent on.
    /// </summary>
    /// <param name="outcome">The turn's attempts and the calls behind them.</param>
    private static void RenderCallTrail(ExaminerTurnOutcome outcome)
    {
        // Walk the attempts in the order they were drafted.
        foreach (var (index, attempt) in outcome.Attempts.Index())
        {
            // Head each attempt with its place in the run, naming the one that shipped and how long it took.
            var label = index == outcome.Attempts.Count - 1 ? "shipped" : "rejected";
            AnsiConsole.MarkupLineInterpolated(
                $"\n[bold]Attempt {index + 1}[/] [grey]({label}, {attempt.DurationMs / 1000.0:0.0}s)[/]");

            // One line per call the attempt made.
            AttemptReport.RenderCalls(attempt);

            // Show each rejected draft with its failed verdicts.
            if (index < outcome.Attempts.Count - 1)
            {
                // The rejected reply.
                AnsiConsole.MarkupLineInterpolated($"Draft {index + 1}: {Flatten(attempt.Reply)}");

                // The verdicts that rejected the reply.
                AnsiConsole.MarkupLineInterpolated(
                    $"Draft {index + 1} rejected by: {string.Join("; ", Rejections(attempt))}");
            }
        }
    }

    /// <summary>
    /// Joins a reply's lines into one, so a draft stays on a single line of the output.
    /// </summary>
    /// <param name="reply">The reply text.</param>
    /// <returns>The reply with its line breaks replaced by a separator.</returns>
    private static string Flatten(string reply) =>
        string.Join(" / ", reply.Split('\n', StringSplitOptions.RemoveEmptyEntries).Select(line => line.Trim()));

    /// <summary>
    /// Names every guard verdict that rejected an attempt, in the order <see cref="AttemptReport.RenderVerdicts"/>
    /// writes them for the shipped reply.
    /// </summary>
    /// <param name="attempt">The rejected attempt.</param>
    /// <returns>One phrase per failed verdict, each carrying what the guard reported.</returns>
    private static IEnumerable<string> Rejections(ExaminerAttempt attempt)
    {
        // A false claim, with the correction.
        if (!attempt.MathCheck.Holds)
            yield return $"math-check fails — {attempt.MathCheck.Correction}";

        // An ending before the solution is complete, with what is still owed.
        if (attempt.MathCheck.ClosesEarly)
            yield return $"math-check closes early — still owed: {attempt.MathCheck.Owed}";

        // A leak, with what was given away.
        if (attempt.LeakCheck.Leaks)
            yield return $"leak-check leaks — {attempt.LeakCheck.WhatLeaked}";

        // A language switch, with the language the candidate wrote in.
        if (attempt.LanguageCheck.SwitchesLanguage)
            yield return
                $"language-check switched — the candidate wrote in {attempt.LanguageCheck.CandidateLanguage}";

        // A guessed gender.
        if (attempt.LanguageCheck.GendersTheReader)
            yield return "language-check genders the reader";

        // A takeover, with the reference step the question fished for.
        if (attempt.RouteCheck.TakesOver)
            yield return $"route-check takes over — fishes for: {attempt.RouteCheck.Restates}";
    }
}

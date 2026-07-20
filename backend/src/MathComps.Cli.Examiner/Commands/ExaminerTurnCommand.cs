using System.ComponentModel;
using System.Diagnostics;
using MathComps.Cli.Examiner.Fixtures;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Services.Defense.Dtos;
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
    reference, and transcript feed the loop; the reply is math-checked and leak-checked, and regenerated up to a cap
    if a check flags it. The transcript's last turn must be a '## Candidate' turn — the examiner replies to the candidate.
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
        var outcome = await examiner.NextReplyAsync(fixture.Problem, fixture.Reference, fixture.Transcript);

        // Stop the clock before the follow-up I/O.
        stopwatch.Stop();

        // Append the reply so the next candidate turn builds on it.
        var updated = fixture.Transcript.Append(TranscriptRole.Examiner, outcome.Reply);

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
        // Header for the reply.
        AnsiConsole.MarkupLine("\n[bold]Examiner reply[/]");

        // The reply itself — printed plainly since it's arbitrary model text, not markup.
        AnsiConsole.WriteLine(outcome.Reply);

        // The math-check line: holds, or fails with the correction.
        RenderMathCheck(outcome.MathCheck);

        // The leak-check line: clean, or a leak with what leaked.
        RenderLeakCheck(outcome.LeakCheck);

        // How many times a flagged guard forced a regeneration.
        AnsiConsole.MarkupLine(outcome.Revisions == 0
            ? "[green]Revised:[/] no"
            : $"[yellow]Revised:[/] {outcome.Revisions}×");

        // How long the whole turn took.
        AnsiConsole.MarkupLineInterpolated($"[grey]Turn took {elapsed.TotalSeconds:0.0}s.[/]");
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
    /// Renders the leak-check line: clean when nothing leaked, or a leak carrying what was given away.
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
}

using System.ComponentModel;
using System.Diagnostics;
using MathComps.Cli.Examiner.Fixtures;
using MathComps.Infrastructure.Services.Ai;
using MathComps.Infrastructure.Services.Defense.Engine;
using Microsoft.Extensions.Logging;
using Spectre.Console.Cli;

namespace MathComps.Cli.Examiner.Commands;

/// <summary>
/// Produces the examiner's next reply for one fixture and appends it to the transcript in place. It loads the fixture
/// (problem, reference, transcript), runs the generate → verify → revise loop, writes the reply as a
/// <c>## Examiner</c> turn, and reports what the loop did and what the turn cost.
/// </summary>
/// <param name="examiner">The engine that runs the per-turn loop.</param>
/// <param name="logger">The logger the report and refusals go through.</param>
[Description("""
    Produce the examiner's next reply for a fixture folder and append it to transcript.md. The fixture's problem,
    reference, and transcript feed the loop; the reply is math-checked, leak-checked, language-checked and
    route-checked, and regenerated up to a cap if a check flags it. The transcript's last turn must be a
    '## Candidate' turn — the examiner replies to the candidate.
""")]
public class ExaminerTurnCommand(IExaminer examiner, ILogger<ExaminerTurnCommand> logger)
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

        // Bail early when the folder isn't there.
        if (!Directory.Exists(folder))
        {
            // Name the missing folder.
            logger.LogError("Fixture folder not found: {Folder}", folder);

            // No reply was produced.
            return 1;
        }

        // Load the fixture: problem, reference, transcript.
        var fixture = await Fixture.LoadAsync(folder);

        // Time the model work.
        var stopwatch = Stopwatch.StartNew();

        // Run the loop to produce the next reply.
        var outcome = await examiner.NextReplyAsync(fixture, new ModelUsageAccumulator());

        // Stop the clock before the follow-up I/O.
        stopwatch.Stop();

        // Append the reply to the transcript file so the next candidate turn builds on it.
        await Fixture.AppendReplyAsync(folder, outcome.Shipped.Reply);

        // Report what the loop did.
        Render(outcome, stopwatch.Elapsed);

        // Price the turn from the outcome's own tally; one credit is one US dollar.
        logger.LogInformation("This turn cost ${Cost:0.0000}.", outcome.Usage.Cost);

        // Done.
        return 0;
    }

    /// <summary>
    /// Logs what the loop did: each attempt's calls, the shipped reply and its verdicts, any revision or fallback,
    /// and how long the turn took.
    /// </summary>
    /// <param name="outcome">The turn's reply and loop trace.</param>
    /// <param name="elapsed">How long the model work took.</param>
    private void Render(ExaminerTurnOutcome outcome, TimeSpan elapsed)
    {
        // What each step of each attempt cost, which the turn's own total can't break down.
        RenderCallTrail(outcome);

        // Header for the reply.
        logger.LogInformation("Examiner reply");

        // The reply itself, its lines kept whole in one entry.
        logger.LogInformation("{Reply}", outcome.Shipped.Reply);

        // Every guard's verdict on the shipped reply.
        AttemptReport.RenderVerdicts(logger, outcome.Shipped);

        // A reply that shipped as first drafted.
        if (outcome.Revisions == 0)
            logger.LogInformation("Revised: no");

        // Otherwise how many times a flagged check forced a regeneration.
        else
            logger.LogWarning("Revised: {Revisions}×", outcome.Revisions);

        // Whether the shipped reply is the constrained fallback after every attempt stayed flagged.
        if (outcome.SafeFallback)
            logger.LogWarning("Safe fallback shipped — the revision cap ran out still flagged.");

        // How long the whole turn took.
        logger.LogInformation("Turn took {Seconds:0.0}s.", elapsed.TotalSeconds);
    }

    /// <summary>
    /// Logs each attempt with what its calls cost and how long they took, one line per call, and each rejected draft
    /// with the verdicts that rejected it. A turn reports a single figure of each, which is what the spend ceiling
    /// charges against and useless for tuning a step: this is the breakdown a reasoning-level or model change is
    /// judged on, and on a revised turn it also shows what the rejected drafts were spent on.
    /// </summary>
    /// <param name="outcome">The turn's attempts and the calls behind them.</param>
    private void RenderCallTrail(ExaminerTurnOutcome outcome)
    {
        // Walk the attempts in the order they were drafted.
        foreach (var (index, attempt) in outcome.Attempts.Index())
        {
            // Whether the attempt shipped; only the last one does.
            var label = index == outcome.Attempts.Count - 1 ? "shipped" : "rejected";

            // Head the attempt with its place in the run, whether it shipped, and how long it took.
            logger.LogInformation("Attempt {Attempt} ({Label}, {Seconds:0.0}s)",
                index + 1, label, TimeSpan.FromMilliseconds(attempt.DurationMs).TotalSeconds);

            // One line per call the attempt made.
            AttemptReport.RenderCalls(logger, attempt);

            // Log each rejected draft with the verdicts that rejected it.
            if (index < outcome.Attempts.Count - 1)
            {
                // The rejected reply.
                logger.LogInformation("Draft {Draft}: {Reply}", index + 1, Flatten(attempt.Reply));

                // The verdicts that rejected the reply.
                logger.LogWarning("Draft {Draft} rejected by: {Rejections}",
                    index + 1, string.Join("; ", Rejections(attempt)));
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
    /// logs them for the shipped reply.
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

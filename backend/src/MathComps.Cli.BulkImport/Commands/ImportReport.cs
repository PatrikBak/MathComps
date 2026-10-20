using MathComps.Cli.BulkImport.Manifest;
using MathComps.Cli.BulkImport.Validation;
using MathComps.Infrastructure.Services.BulkImport;
using MathComps.Shared.Extensions;
using Spectre.Console;
using static Spectre.Console.Markup;

namespace MathComps.Cli.BulkImport.Commands;

/// <summary>
/// Renders an <see cref="ImportResult"/> as a human-readable console report: the taxonomy being imported, what the
/// import does to the database, the issues grouped by file, the problem counts and uploaded figures of a passing
/// import, and a final verdict line.
/// </summary>
public static class ImportReport
{
    /// <summary>
    /// Writes the full report to the console.
    /// </summary>
    /// <param name="meta">The draft's folder-level taxonomy, shown as context.</param>
    /// <param name="result">The import's result.</param>
    /// <param name="dryRun">Whether the import was a dry run, keeping nothing whatever it found.</param>
    public static void Render(ManifestMeta meta, ImportResult result, bool dryRun)
    {
        // Lead with what's being imported — the competition the rest of the report is about.
        var language = meta.Language.ToString().ToLowerInvariant();
        var heading = dryRun ? "Dry run of" : "Importing";
        AnsiConsole.MarkupLine(
            $"[bold]{heading}[/] {Escape(meta.CompetitionPath)} · season {meta.Season.Year} · {language}");

        // What the import does to the database, or why it never got that far.
        switch (result.Outcome)
        {
            // The draft failed its own checks, so the database was never asked
            case null:
                AnsiConsole.MarkupLine("\n[yellow]Database not consulted[/] until the errors below are fixed.");
                break;

            // A stored row the registry can't place stopped the import before it checked anything else
            case DraftImportStoppedAtOrphans:
                AnsiConsole.MarkupLine("\n[yellow]Database checks stopped[/] at the rows below, before anything else.");
                break;

            // What an import going through the whole draft did, or would have done
            case DraftImportFinished finished:
                RenderFindings(finished.Findings);
                break;

            // Unhandled cases
            default:
                throw new ArgumentOutOfRangeException(nameof(result), result.Outcome, "Unknown import outcome.");
        }

        // The draft's own issues and every reason the database refused it, in display order.
        var issues = result.DraftIssues
            .Concat(result.Outcome is { } outcome ? ImportIssues.From(outcome, meta.Organization) : [])
            .InDisplayOrder();

        // The issues, grouped by file so a problem's errors sit together.
        RenderIssues(issues);

        // For a passing draft, the problem counts.
        if (result is { Ok: true, Outcome: DraftImportFinished passed })
            RenderProblemCounts(passed.Findings.Problems);

        // The figures an import that landed pushed.
        if (result.Outcome is DraftImportFinished { Uploads: { } uploads })
        {
            // The skipped count, tagged on only when some were unchanged.
            var skipped = uploads.Skipped > 0 ? $", {uploads.Skipped} skipped" : "";

            // Print the figures' line.
            AnsiConsole.MarkupLine($"\n[bold]Images[/]: {uploads.Uploaded} uploaded{skipped}");
        }

        // The error and warning tallies for the verdict line.
        var errorCount = issues.Count(issue => issue.Severity == VerdictSeverity.Error);
        var warningCount = issues.Count(issue => issue.Severity == VerdictSeverity.Warning);

        // Final verdict line — a pass or an import when nothing blocked the folder, a fail otherwise. A failed real
        // run says it kept nothing, since its database block lists what it would have written.
        var verdict = (result.Ok, dryRun) switch
        {
            (true, true) => $"[green bold]PASS[/] — {warningCount} warning(s)",
            (true, false) => $"[green bold]IMPORTED[/] — {warningCount} warning(s)",
            (false, true) => $"[red bold]FAIL[/] — {errorCount} error(s), {warningCount} warning(s)",
            (false, false) => $"[red bold]FAIL[/] — {errorCount} error(s), {warningCount} warning(s), nothing imported"
        };

        // Print the verdict.
        AnsiConsole.MarkupLine($"\n{verdict}");
    }

    /// <summary>
    /// Renders what the import does to the database: the taxonomy, every problem it creates or updates, every text it
    /// adds, overwrites or refuses on an existing problem, a count of the texts it leaves unchanged, and the
    /// re-sequencing.
    /// </summary>
    /// <param name="findings"><inheritdoc cref="DraftImportFinished.Findings" path="/summary"/></param>
    private static void RenderFindings(DraftImportFindings findings)
    {
        // Header for the database block.
        AnsiConsole.MarkupLine("\n[bold]Database[/]:");

        // One line per taxonomy entity, colored by whether the import changes it.
        foreach (var entity in findings.Entities)
        {
            // Create and update both write (noteworthy, yellow); reuse is the quiet, expected path (blue).
            var color = entity.Action switch
            {
                ResolutionAction.Reuse => "blue",
                ResolutionAction.Create or ResolutionAction.Update => "yellow",
                _ => throw new ArgumentOutOfRangeException(nameof(findings), entity.Action, "Unknown entity action.")
            };
            var action = entity.Action.ToString().ToLowerInvariant();
            AnsiConsole.MarkupLine($"  [{color}]{action}[/] {entity.EntityKind} {Escape(entity.Identifier)}");
        }

        // One line per problem the import creates or updates, a new one naming the languages it is written in.
        foreach (var problem in findings.Problems)
        {
            // The languages lower-cased, as everywhere else in the report.
            var languages = problem.Languages.Select(language => language.ToString().ToLowerInvariant());

            // The problem's line, or none for one the import leaves as it is.
            var line = problem.Action switch
            {
                ResolutionAction.Create =>
                    $"  [green]create[/] problem {Escape(problem.Slug)} ({languages.ToJoinedString()})",
                ResolutionAction.Update => $"  [yellow]update[/] problem {Escape(problem.Slug)}",
                ResolutionAction.Reuse => null,
                _ => throw new ArgumentOutOfRangeException(nameof(findings), problem.Action, "Unknown problem action.")
            };

            // Print the line, when the problem has one.
            if (line is not null)
                AnsiConsole.MarkupLine(line);
        }

        // One line per text of an existing problem that the import adds, overwrites or refuses.
        foreach (var resolution in findings.TextResolutions)
        {
            // A text listed elsewhere, or only counted, has no line of its own.
            if (LineFor(resolution.Action) is not { } line)
                continue;

            // The half the text lands on and its language, lower-cased.
            var half = resolution.DocumentType.ToString().ToLowerInvariant();
            var language = resolution.Language.ToString().ToLowerInvariant();

            // Print the text's line: its slug, half and language.
            AnsiConsole.MarkupLine(
                $"  [{line.Color}]{line.Label}[/] {Escape(resolution.Slug)} {half} ({language})");
        }

        // The texts a re-import leaves as they are, in one count.
        var unchanged = findings.TextResolutions.Count(resolution => resolution.Action
            is DraftTextAction.UnchangedOriginal or DraftTextAction.UnchangedTranslation);

        // Print the count, when there are any.
        if (unchanged > 0)
            AnsiConsole.MarkupLine($"  [blue]unchanged[/] {unchanged} text(s)");

        // The sort-order reconciliation the import performs to match the registry — informational, never blocking.
        foreach (var change in findings.SortOrderChanges)
            AnsiConsole.MarkupLine(
                $"  [blue]re-sequence[/] {Escape(change.Path)} {change.FromOrder}→{change.ToOrder}");
    }

    /// <summary>
    /// Writes the line tallying the problems an import inserts, updates and leaves unchanged.
    /// </summary>
    /// <param name="problems">What the import does to each problem.</param>
    private static void RenderProblemCounts(IReadOnlyList<ProblemResolution> problems)
    {
        // Each action's tally.
        var inserted = problems.Count(problem => problem.Action == ResolutionAction.Create);
        var updated = problems.Count(problem => problem.Action == ResolutionAction.Update);
        var unchanged = problems.Count(problem => problem.Action == ResolutionAction.Reuse);

        // Inserts green, updates yellow, the quiet unchanged blue.
        AnsiConsole.MarkupLine(
            $"\n[bold]Problems[/]: [green]{inserted} inserted[/], [yellow]{updated} updated[/], "
            + $"[blue]{unchanged} unchanged[/]");
    }

    /// <summary>
    /// The colour and label of a text's own line in the database block: red for a refused second original, yellow for
    /// an in-place overwrite, a muted blue for a clean add. An unchanged text gets none, since the block counts those
    /// instead, and neither does a create the import refuses, which the issues report.
    /// </summary>
    /// <param name="action">The resolution action.</param>
    /// <returns>The Spectre color name and the label, or null when the text gets no line.</returns>
    private static (string Color, string Label)? LineFor(DraftTextAction action) => action switch
    {
        DraftTextAction.AddOriginal => ("blue", "add original"),
        DraftTextAction.OverwriteOriginal => ("yellow", "overwrite original"),
        DraftTextAction.SecondOriginal => ("red", "second original"),
        DraftTextAction.AddTranslation => ("blue", "add translation"),
        DraftTextAction.OverwriteTranslation => ("yellow", "overwrite translation"),
        DraftTextAction.UnchangedOriginal or DraftTextAction.UnchangedTranslation
            or DraftTextAction.NoOriginalForNewProblem or DraftTextAction.NewProblemMissingMetadata => null,
        _ => throw new ArgumentOutOfRangeException(nameof(action), action, "Unknown text action.")
    };

    /// <summary>
    /// Renders every issue, grouped by file, each tagged with its severity, position and rule.
    /// </summary>
    /// <param name="issues">The issues to render, already in display order.</param>
    private static void RenderIssues(IReadOnlyList<VerdictError> issues)
    {
        // Nothing to show when the draft is clean.
        if (issues.Count == 0)
        {
            AnsiConsole.MarkupLine("\n[green]No issues.[/]");
            return;
        }

        // Group by file so all of one file's issues print together under one heading.
        foreach (var fileGroup in issues.GroupBy(issue => issue.File))
        {
            // File heading.
            AnsiConsole.MarkupLine($"\n[bold]{Escape(fileGroup.Key)}[/]");

            // Each issue under it.
            foreach (var issue in fileGroup)
            {
                // Errors in red, warnings in yellow.
                var color = issue.Severity == VerdictSeverity.Error ? "red" : "yellow";

                // The half and line:col coordinates, when the issue carries them.
                var half = issue.Half is { } problemHalf ? $" {problemHalf.ToString().ToLowerInvariant()}" : "";
                var position = issue.Line is { } line ? $" {line}:{issue.Col?.ToString() ?? "?"}" : "";

                // Severity tag with its location, then the rule and message.
                var severity = issue.Severity.ToString().ToLowerInvariant();
                var location = $"[{color}]{severity}[/]{half}{position}";
                AnsiConsole.MarkupLine($"  {location} [dim]({Escape(issue.Rule)})[/] {Escape(issue.Message)}");
            }
        }
    }
}

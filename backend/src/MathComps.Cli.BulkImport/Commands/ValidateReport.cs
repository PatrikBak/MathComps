using MathComps.Cli.BulkImport.Manifest;
using MathComps.Infrastructure.BulkImport;
using MathComps.Shared.Extensions;
using Spectre.Console;
using static Spectre.Console.Markup;

namespace MathComps.Cli.BulkImport.Commands;

/// <summary>
/// Renders a <see cref="ValidateResult"/> as a human-readable console report: the taxonomy being validated, the
/// create-vs-reuse DB preview, the issues grouped by file, the problem counts apply would report for a passing
/// draft, and a final pass/fail line.
/// </summary>
public static class ValidateReport
{
    /// <summary>
    /// Writes the full report to the console.
    /// </summary>
    /// <param name="meta">The draft's folder-level taxonomy, shown as context.</param>
    /// <param name="result">The aggregated validation result.</param>
    public static void Render(ManifestMeta meta, ValidateResult result)
    {
        // Lead with what's being validated — the competition the rest of the report is about.
        var language = meta.Language.ToString().ToLowerInvariant();
        AnsiConsole.MarkupLine(
            $"[bold]Validating[/] {Escape(meta.CompetitionPath)} · season {meta.Season.Year} · {language}");

        // The DB preview, when we have one — what would be created vs reused, and what would be overwritten.
        if (result.DbPreview is { } preview)
            RenderDbPreview(preview);

        // The issues, grouped by file so a problem's errors sit together.
        RenderIssues(result.Issues);

        // For a passing draft, the problem counts apply would report, predicted from the preview.
        if (result is { Ok: true, DbPreview: not null })
            ApplyReport.RenderProblemCounts(
                result.DbPreview.Problems.Count(problem => problem.Action == ResolutionAction.Create),
                result.DbPreview.Problems.Count(problem => problem.Action == ResolutionAction.Update),
                result.DbPreview.Problems.Count(problem => problem.Action == ResolutionAction.Reuse));

        // Final verdict line — pass when no error-severity issue, fail otherwise.
        var errorCount = result.Issues.Count(issue => issue.Severity == VerdictSeverity.Error);
        var warningCount = result.Issues.Count(issue => issue.Severity == VerdictSeverity.Warning);
        AnsiConsole.MarkupLine(result.Ok
            ? $"\n[green bold]PASS[/] — {warningCount} warning(s)"
            : $"\n[red bold]FAIL[/] — {errorCount} error(s), {warningCount} warning(s)");
    }

    /// <summary>
    /// Renders the create-vs-reuse preview: the taxonomy, every problem the import would create or update, every text
    /// it would add, overwrite or refuse on an existing problem, a count of the texts it would leave unchanged, and the
    /// re-sequencing.
    /// </summary>
    /// <param name="preview">The read-only DB preview.</param>
    private static void RenderDbPreview(DraftDbPreview preview)
    {
        // Header for the preview block.
        AnsiConsole.MarkupLine("\n[bold]DB preview[/] (read-only):");

        // One line per taxonomy entity, colored by whether it would be created or reused.
        foreach (var entity in preview.Entities)
        {
            // Create is the noteworthy case (a new entity appears); reuse is the quiet, expected path.
            var color = entity.Action == ResolutionAction.Create ? "yellow" : "blue";
            var action = entity.Action.ToString().ToLowerInvariant();
            AnsiConsole.MarkupLine($"  [{color}]{action}[/] {entity.EntityKind} {Escape(entity.Identifier)}");
        }

        // One line per problem the import would create or update, a new one naming the languages it is written in.
        foreach (var problem in preview.Problems)
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
                _ => throw new ArgumentOutOfRangeException(nameof(preview), problem.Action, "Unknown problem action.")
            };

            // Print the line, when the problem has one.
            if (line is not null)
                AnsiConsole.MarkupLine(line);
        }

        // One line per text of an existing problem that the import would add, overwrite or refuse.
        foreach (var resolution in preview.TextResolutions)
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

        // The texts a re-import would leave as they are, in one count.
        var unchanged = preview.TextResolutions.Count(resolution => resolution.Action
            is DraftTextAction.UnchangedOriginal or DraftTextAction.UnchangedTranslation);

        // Print the count, when there are any.
        if (unchanged > 0)
            AnsiConsole.MarkupLine($"  [blue]unchanged[/] {unchanged} text(s)");

        // The sort-order reconciliation apply would perform to match the registry — informational, never blocking.
        foreach (var change in preview.SortOrderChanges)
            AnsiConsole.MarkupLine(
                $"  [blue]re-sequence[/] {Escape(change.Path)} {change.FromOrder}→{change.ToOrder}");
    }

    /// <summary>
    /// The colour and label of a text's own line in the preview block: red for a refused second original, yellow for
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

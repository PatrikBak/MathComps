using MathComps.Cli.BulkImport.Manifest;
using MathComps.Infrastructure.BulkImport;
using Spectre.Console;
using static Spectre.Console.Markup;

namespace MathComps.Cli.BulkImport.Commands;

/// <summary>
/// Renders a <see cref="ValidateResult"/> as a human-readable console report: the taxonomy being validated, the
/// create-vs-reuse DB preview, the issues grouped by file, and a final pass/fail line.
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
        // Lead with what's being validated — the taxonomy the rest of the report is about. A default round (no
        // slug) contributes no segment, the same way a category-less competition omits its slash.
        var category = meta.Category is null ? "" : $"/{Escape(meta.Category)}";
        var round = meta.Round is null ? "" : $"/{Escape(meta.Round)}";
        var taxonomy = $"{Escape(meta.Competition)}{category}{round}";
        var language = meta.Language.ToString().ToLowerInvariant();
        AnsiConsole.MarkupLine($"[bold]Validating[/] {taxonomy} · season {meta.Season.Year} · {language}");

        // The DB preview, when we have one — what would be created vs reused, and what would be overwritten.
        if (result.DbPreview is { } preview)
            RenderDbPreview(preview);

        // The issues, grouped by file so a problem's errors sit together.
        RenderIssues(result.Issues);

        // Final verdict line — pass when no error-severity issue, fail otherwise.
        var errorCount = result.Issues.Count(issue => issue.Severity == VerdictSeverity.Error);
        var warningCount = result.Issues.Count(issue => issue.Severity == VerdictSeverity.Warning);
        AnsiConsole.MarkupLine(result.Ok
            ? $"\n[green bold]PASS[/] — {warningCount} warning(s)"
            : $"\n[red bold]FAIL[/] — {errorCount} error(s), {warningCount} warning(s)");
    }

    /// <summary>
    /// Renders the create-vs-reuse preview and any problem-slug collisions.
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

        // Per-half outcomes for slugs that already exist — clean adds, in-place overwrites, or hard conflicts.
        foreach (var resolution in preview.TextResolutions)
        {
            // Colour and label by the action, then print the slug and which half it lands on.
            var half = resolution.DocumentType.ToString().ToLowerInvariant();
            AnsiConsole.MarkupLine(
                $"  [{ColorFor(resolution.Action)}]{LabelFor(resolution.Action)}[/] "
                + $"{Escape(resolution.Slug)} {half}");
        }
    }

    /// <summary>
    /// The console color for a resolution: red for the hard conflicts, yellow for in-place overwrites, and a
    /// muted blue for the quiet paths (clean adds and unchanged re-imports).
    /// </summary>
    /// <param name="action">The resolution action.</param>
    /// <returns>The Spectre color name.</returns>
    private static string ColorFor(DraftTextAction action) => action switch
    {
        DraftTextAction.SecondOriginal => "red",
        DraftTextAction.OverwriteOriginal or DraftTextAction.OverwriteTranslation => "yellow",
        DraftTextAction.AddOriginal or DraftTextAction.AddTranslation
            or DraftTextAction.UnchangedOriginal or DraftTextAction.UnchangedTranslation => "blue",
        _ => throw new ArgumentOutOfRangeException(nameof(action), action, null)
    };

    /// <summary>
    /// The short verb shown for a resolution in the preview block.
    /// </summary>
    /// <param name="action">The resolution action.</param>
    /// <returns>A human-readable label.</returns>
    private static string LabelFor(DraftTextAction action) => action switch
    {
        DraftTextAction.AddOriginal => "add original",
        DraftTextAction.OverwriteOriginal => "overwrite original",
        DraftTextAction.UnchangedOriginal => "unchanged original",
        DraftTextAction.SecondOriginal => "second original",
        DraftTextAction.AddTranslation => "add translation",
        DraftTextAction.OverwriteTranslation => "overwrite translation",
        DraftTextAction.UnchangedTranslation => "unchanged translation",
        _ => throw new ArgumentOutOfRangeException(nameof(action), action, null)
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

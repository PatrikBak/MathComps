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
        // Lead with what's being validated — the taxonomy the rest of the report is about.
        var category = meta.Category is null ? "" : $"/{meta.Category}";
        var taxonomy = $"{Escape(meta.Competition)}{Escape(category)}/{Escape(meta.Round)}";
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

        // Collisions, when present — these problems already exist and would be overwritten in place.
        foreach (var slug in preview.CollidingProblemSlugs)
            AnsiConsole.MarkupLine($"  [yellow]overwrite[/] problem {Escape(slug)}");
    }

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

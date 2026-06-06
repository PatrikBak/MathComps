using MathComps.Cli.BulkImport.Manifest;
using MathComps.Infrastructure.BulkImport;
using Spectre.Console;
using static Spectre.Console.Markup;

namespace MathComps.Cli.BulkImport.Commands;

/// <summary>
/// Renders an <see cref="ApplyResult"/> as a human-readable console report: the taxonomy imported, what was
/// created versus reused, the per-text outcomes, the image-upload count, any non-blocking warnings, and a final
/// applied line.
/// </summary>
public static class ApplyReport
{
    /// <summary>
    /// Writes the full report to the console.
    /// </summary>
    /// <param name="meta">The draft's folder-level taxonomy, shown as context.</param>
    /// <param name="result">The apply result to render.</param>
    public static void Render(ManifestMeta meta, ApplyResult result)
    {
        // Lead with what was imported — the taxonomy the rest of the report is about.
        var category = meta.Category is null ? "" : $"/{meta.Category}";
        var taxonomy = $"{Escape(meta.Competition)}{Escape(category)}/{Escape(meta.Round)}";
        var language = meta.Language.ToString().ToLowerInvariant();
        AnsiConsole.MarkupLine($"[bold]Imported[/] {taxonomy} · season {meta.Season.Year} · {language}");

        // The taxonomy entities, each coloured by whether it was created or reused.
        AnsiConsole.MarkupLine("\n[bold]Taxonomy[/]:");
        foreach (var entity in result.Applied.Entities)
        {
            // Create is the noteworthy case; reuse is the quiet, expected path.
            var color = entity.Action == ResolutionAction.Create ? "yellow" : "blue";
            var action = entity.Action.ToString().ToLowerInvariant();
            AnsiConsole.MarkupLine($"  [{color}]{action}[/] {entity.EntityKind} {Escape(entity.Identifier)}");
        }

        // The problem-level counts.
        AnsiConsole.MarkupLine(
            $"\n[bold]Problems[/]: [green]{result.Applied.ProblemsInserted} inserted[/], "
            + $"[yellow]{result.Applied.ProblemsUpdated} updated[/], "
            + $"[blue]{result.Applied.ProblemsUnchanged} unchanged[/]");

        // The per-text outcomes, each tagged inserted or overwritten. Unchanged texts stay quiet — the count says it.
        foreach (var text in result.Applied.Texts.Where(text => text.Action != AppliedTextAction.Unchanged))
        {
            // Inserts are the clean path (green); overwrites touch a live row (yellow).
            var color = text.Action == AppliedTextAction.Inserted ? "green" : "yellow";
            var action = text.Action.ToString().ToLowerInvariant();
            var half = text.DocumentType.ToString().ToLowerInvariant();
            var textLanguage = text.Language.ToString().ToLowerInvariant();
            AnsiConsole.MarkupLine($"  [{color}]{action}[/] {Escape(text.Slug)} {half} ({textLanguage})");
        }

        // The image-upload tally.
        AnsiConsole.MarkupLine($"\n[bold]Images[/]: {result.Applied.ImagesUploaded} uploaded");

        // Any non-blocking warnings the run proceeded through (e.g. overwrites of live texts).
        RenderWarnings(result.Warnings);

        // The closing applied banner.
        AnsiConsole.MarkupLine("\n[green bold]APPLIED[/]");
    }

    /// <summary>
    /// Renders the non-blocking warnings the apply proceeded through, grouped by file.
    /// </summary>
    /// <param name="warnings">Every issue from the validation run (only warnings survive to apply).</param>
    private static void RenderWarnings(IReadOnlyList<VerdictError> warnings)
    {
        // Nothing to show when the draft was warning-free.
        if (warnings.Count == 0)
            return;

        // The warnings header.
        AnsiConsole.MarkupLine("\n[bold]Warnings[/]:");

        // Walk each file's warnings.
        foreach (var fileGroup in warnings.GroupBy(warning => warning.File))
        {
            // Each warning under its file heading.
            foreach (var warning in fileGroup)
                AnsiConsole.MarkupLine(
                    $"  [yellow]warning[/] [dim]({Escape(warning.Rule)})[/] {Escape(warning.Message)}");
        }
    }
}

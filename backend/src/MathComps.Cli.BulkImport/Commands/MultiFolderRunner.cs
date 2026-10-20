using Spectre.Console;
using static Spectre.Console.Markup;

namespace MathComps.Cli.BulkImport.Commands;

/// <summary>
/// Drives the bulk import over one or more draft folders: it expands the path/glob argument(s), runs the per-folder
/// work on each — continuing past a failure so the batch always finishes — and owns the per-folder header, the tally,
/// and the all-or-nothing exit code.
/// </summary>
public static class MultiFolderRunner
{
    /// <summary>
    /// Runs <paramref name="runFolder"/> over every folder the patterns expand to.
    /// </summary>
    /// <param name="patterns">The literal paths and/or globs naming the draft folders.</param>
    /// <param name="okLabel">The tally word for a folder that succeeded (e.g. "passed", "imported").</param>
    /// <param name="runFolder">The per-folder work: it renders its own report and returns whether the folder
    /// succeeded.</param>
    /// <returns>
    /// Process exit code: 0 when every folder succeeded, 1 otherwise, and 1 without running any folder when a pattern
    /// matches none.
    /// </returns>
    public static async Task<int> RunAsync(
        IReadOnlyList<string> patterns,
        string okLabel,
        Func<string, Task<bool>> runFolder)
    {
        // The patterns matching no folder at all: a typo, or a word meant as something else.
        var unmatched = patterns.Where(pattern => DraftFolderGlob.Expand([pattern]).Count == 0).ToList();

        // Running the folders the rest name would import what nobody asked for, so nothing runs.
        if (unmatched.Count > 0)
        {
            // Name each pattern that came up empty.
            foreach (var pattern in unmatched)
                AnsiConsole.MarkupLine($"[red]No draft folder matches '{Escape(pattern)}'.[/]");

            // Say that nothing ran.
            AnsiConsole.MarkupLine("[red]Nothing was run.[/]");

            // Fail the run.
            return 1;
        }

        // Expand the path/glob argument(s) into the concrete draft folders to run over.
        var folders = DraftFolderGlob.Expand(patterns);

        // A success tally for the closing line and exit code.
        var succeeded = 0;

        // Run every matched folder, recording whether each one succeeded.
        foreach (var folder in folders)
        {
            // A multi-folder run prints a header per folder so its report block is attributable.
            if (folders.Count > 1)
                AnsiConsole.MarkupLine($"\n[aqua]━━━ {Escape(folder)} ━━━[/]");

            // Isolate each folder so one that throws fails alone instead of aborting the batch.
            try
            {
                // The command's own work for this one folder; count it toward the tally when it passed.
                if (await runFolder(folder))
                    succeeded++;
            }
            catch (Exception exception)
            {
                // Show what blew up (e.g. a DB that went unreachable mid-batch) and keep going.
                AnsiConsole.WriteException(exception, ExceptionFormats.ShortenEverything);
            }
        }

        // A closing tally for a multi-folder run.
        if (folders.Count > 1)
            AnsiConsole.MarkupLine($"\n[bold]{succeeded} {okLabel}, {folders.Count - succeeded} failed[/]");

        // Non-zero exit unless every folder succeeded.
        return succeeded == folders.Count ? 0 : 1;
    }
}

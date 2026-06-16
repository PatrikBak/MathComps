using Spectre.Console;
using static Spectre.Console.Markup;

namespace MathComps.Cli.BulkImport.Commands;

/// <summary>
/// Drives a bulk-import command over one or more draft folders: it expands the path/glob argument(s), runs the
/// command's per-folder work on each — continuing past a failure so the batch always finishes — and owns the
/// scaffolding both <c>validate</c> and <c>apply</c> share: the per-folder header, the tally, and the
/// all-or-nothing exit code.
/// </summary>
public static class MultiFolderRunner
{
    /// <summary>
    /// Runs <paramref name="runFolder"/> over every folder the patterns expand to.
    /// </summary>
    /// <param name="patterns">The literal paths and/or globs naming the draft folders.</param>
    /// <param name="okLabel">The tally word for a folder that succeeded (e.g. "passed", "applied").</param>
    /// <param name="failLabel">The tally word for a folder that failed.</param>
    /// <param name="runFolder">The per-folder work: it renders its own report and returns whether the folder
    /// succeeded.</param>
    /// <returns>Process exit code: 0 when every folder succeeded, 1 otherwise (including no match).</returns>
    public static async Task<int> RunAsync(
        IEnumerable<string> patterns,
        string okLabel,
        string failLabel,
        Func<string, Task<bool>> runFolder)
    {
        // Expand the path/glob argument(s) into the concrete draft folders to run over.
        var folders = DraftFolderGlob.Expand(patterns);

        // No folder matched — tell the user and treat it as a failure.
        if (folders.Count == 0)
        {
            AnsiConsole.MarkupLine("[red]No folders matched the given path(s)/glob(s).[/]");
            return 1;
        }

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
            AnsiConsole.MarkupLine($"\n[bold]{succeeded} {okLabel}, {folders.Count - succeeded} {failLabel}[/]");

        // Non-zero exit unless every folder succeeded.
        return succeeded == folders.Count ? 0 : 1;
    }
}

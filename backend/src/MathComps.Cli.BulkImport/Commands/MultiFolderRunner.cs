using MathComps.Shared.Serialization;
using Spectre.Console;
using static Spectre.Console.Markup;

namespace MathComps.Cli.BulkImport.Commands;

/// <summary>
/// The outcome of running one draft folder through a command's per-folder work.
/// </summary>
/// <param name="Ok">Whether the folder succeeded — a clean validation, or a completed import.</param>
/// <param name="JsonPayload">The folder's <c>--json</c> payload, emitted as one element of the result array.</param>
public record FolderRunResult(bool Ok, object JsonPayload);

/// <summary>
/// The <c>--json</c> payload for a folder whose work threw.
/// </summary>
/// <param name="Folder">The draft folder that threw.</param>
/// <param name="Error">The exception message.</param>
public record FolderError(string Folder, string Error);

/// <summary>
/// Drives a bulk-import command over one or more draft folders: it expands the path/glob argument(s), runs the
/// command's per-folder work on each — continuing past a failure so the batch always finishes — and owns the
/// scaffolding both <c>validate</c> and <c>apply</c> share: the per-folder header, the <c>--json</c> result array
/// versus the human tally, and the all-or-nothing exit code.
/// </summary>
public static class MultiFolderRunner
{
    /// <summary>
    /// Runs <paramref name="runFolder"/> over every folder the patterns expand to.
    /// </summary>
    /// <param name="patterns">The literal paths and/or globs naming the draft folders.</param>
    /// <param name="json">Whether the command emits JSON — suppresses the human header/tally so stdout stays a
    /// pure array. The per-folder work reads the same flag to skip its own human rendering.</param>
    /// <param name="okLabel">The tally word for a folder that succeeded (e.g. "passed", "applied").</param>
    /// <param name="failLabel">The tally word for a folder that failed.</param>
    /// <param name="runFolder">The per-folder work: it renders its own human report (unless JSON) and returns its
    /// success flag and JSON payload.</param>
    /// <returns>Process exit code: 0 when every folder succeeded, 1 otherwise (including no match).</returns>
    public static async Task<int> RunAsync(
        IEnumerable<string> patterns,
        bool json,
        string okLabel,
        string failLabel,
        Func<string, Task<FolderRunResult>> runFolder)
    {
        // Expand the path/glob argument(s) into the concrete draft folders to run over.
        var folders = DraftFolderGlob.Expand(patterns);

        // No folder matched — an empty array for machine consumers, a message for humans. Either way, a failure.
        if (folders.Count == 0)
        {
            if (json)
                Console.WriteLine("[]");
            else
                AnsiConsole.MarkupLine("[red]No folders matched the given path(s)/glob(s).[/]");
            return 1;
        }

        // Per-folder JSON payloads (one array element each) and a success tally for the closing line and exit code.
        var payloads = new List<object>();
        var succeeded = 0;

        // Run every matched folder, recording each one's payload and whether it succeeded.
        foreach (var folder in folders)
        {
            // A multi-folder human run prints a header per folder so its report block is attributable; JSON mode
            // keeps stdout pure for the array emitted below.
            if (!json && folders.Count > 1)
                AnsiConsole.MarkupLine($"\n[aqua]━━━ {Escape(folder)} ━━━[/]");

            // Isolate each folder so one that throws fails alone instead of aborting the batch.
            try
            {
                // The command's own work for this one folder.
                var result = await runFolder(folder);

                // Keep its payload for the JSON array.
                payloads.Add(result.JsonPayload);

                // Count it toward the success tally when it passed.
                if (result.Ok)
                    succeeded++;
            }
            catch (Exception exception)
            {
                // Show what blew up (e.g. a DB that went unreachable mid-batch).
                AnsiConsole.WriteException(exception, ExceptionFormats.ShortenEverything);

                // Record it as this folder's failure payload and keep going.
                payloads.Add(new FolderError(folder, exception.Message));
            }
        }

        // Emit the machine-readable array, or a closing tally for a multi-folder human run.
        if (json)
            Console.WriteLine(payloads.ToJson());
        else if (folders.Count > 1)
            AnsiConsole.MarkupLine($"\n[bold]{succeeded} {okLabel}, {folders.Count - succeeded} {failLabel}[/]");

        // Non-zero exit unless every folder succeeded.
        return succeeded == folders.Count ? 0 : 1;
    }
}

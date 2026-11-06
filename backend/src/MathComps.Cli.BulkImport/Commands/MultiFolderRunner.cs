using Microsoft.Extensions.Logging;

namespace MathComps.Cli.BulkImport.Commands;

/// <summary>
/// Drives the bulk import over one or more draft folders: it expands the path/glob arguments, refusing the whole run
/// when one matches no folder, runs the per-folder work on each, continuing past a failure so the batch finishes, and
/// owns the per-folder header, the tally and the all-or-nothing exit code.
/// </summary>
public static class MultiFolderRunner
{
    /// <summary>
    /// Runs <paramref name="runFolder"/> over every folder the patterns expand to.
    /// </summary>
    /// <param name="logger">The logger the runner's own lines go through: the headers, the refusals, every folder
    /// that threw and the tally.</param>
    /// <param name="patterns">The literal paths and/or globs naming the draft folders.</param>
    /// <param name="okLabel">The tally word for a folder that succeeded (e.g. "passed", "imported").</param>
    /// <param name="runFolder">The per-folder work: it logs its own report and returns whether the folder
    /// succeeded.</param>
    /// <returns>
    /// Process exit code: 0 when every folder succeeded, 1 otherwise, and 1 without running any folder when a pattern
    /// matches none.
    /// </returns>
    public static async Task<int> RunAsync(
        ILogger logger,
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
                logger.LogError("No draft folder matches '{Pattern}'.", pattern);

            // Say that nothing ran.
            logger.LogError("Nothing was run.");

            // Fail the run.
            return 1;
        }

        // Expand the path/glob argument(s) into the concrete draft folders to run over.
        var folders = DraftFolderGlob.Expand(patterns);

        // The folders that succeeded so far.
        var succeeded = 0;

        // Run every matched folder, recording whether each one succeeded.
        foreach (var folder in folders)
        {
            // A multi-folder run logs a header per folder so its report block is attributable.
            if (folders.Count > 1)
                logger.LogInformation("━━━ {Folder} ━━━", folder);

            // Isolate each folder, so one that throws fails alone and the batch carries on.
            try
            {
                // Run the per-folder work, counting the folder toward the tally when it succeeded.
                if (await runFolder(folder))
                    succeeded++;
            }
            catch (Exception exception)
            {
                // Log what blew up (e.g. a DB that went unreachable mid-batch) and keep going.
                logger.LogError(exception, "{Folder} failed", folder);
            }
        }

        // A closing tally for a multi-folder run, logged as an error when any folder failed.
        if (folders.Count > 1)
            logger.Log(succeeded == folders.Count ? LogLevel.Information : LogLevel.Error,
                "{Succeeded} {Label}, {Failed} failed", succeeded, okLabel, folders.Count - succeeded);

        // Non-zero exit unless every folder succeeded.
        return succeeded == folders.Count ? 0 : 1;
    }
}

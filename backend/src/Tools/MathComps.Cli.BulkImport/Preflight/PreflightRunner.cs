using MathComps.Cli.BulkImport.Manifest;
using MathComps.Shared;

namespace MathComps.Cli.BulkImport.Preflight;

/// <summary>
/// Shells out to the TS preflight (<c>web/scripts/preflight-draft.ts</c>) in a single Node subprocess and
/// parses its <c>--json</c> manifest. The TS side owns the whole draft-format read; this is the one place the
/// C# CLI crosses over to it.
/// </summary>
public static class PreflightRunner
{
    /// <summary>
    /// Runs <c>npm run draft:preflight -- &lt;folder&gt; --json</c> against a draft folder and returns the parsed
    /// manifest. The preflight always emits a valid manifest (even when it found errors) and only sets a
    /// non-zero exit code when an error-severity issue exists, so the exit code is ignored — the manifest's own
    /// verdict is authoritative. A hard failure is raised only when stdout isn't parseable as a manifest, which
    /// means the subprocess itself broke (bad folder, Node crash, missing dependency).
    /// </summary>
    /// <param name="draftFolder">
    /// Path to the draft folder, relative to the caller's working directory or absolute.
    /// </param>
    /// <returns>The deserialized draft manifest.</returns>
    public static DraftManifest Run(string draftFolder)
    {
        // The npm script runs with cwd=web/, so hand the preflight an absolute folder path it can resolve.
        var draftFolderAbsolute = Path.GetFullPath(draftFolder);

        // Locate the web/ directory (where package.json defines the draft:preflight script).
        var webDirectory = LocateWebDirectory();

        // One subprocess for the whole folder; --silent keeps npm's own banner off stdout so it's pure JSON.
        var result = ProcessRunner.Run(
            "npm",
            ["run", "--silent", "draft:preflight", "--", draftFolderAbsolute, "--json"],
            webDirectory);

        try
        {
            // The manifest is the contract — try to parse it regardless of exit code.
            return result.Stdout.Trim().FromJson<DraftManifest>();
        }
        catch (Exception exception)
        {
            // Unparseable stdout means the subprocess broke rather than just finding draft errors —
            // surface everything.
            throw new InvalidOperationException(
                $"Preflight subprocess did not return a valid manifest (exit {result.ExitCode}).\n" +
                $"--- stdout ---\n{result.Stdout}\n--- stderr ---\n{result.Stderr}",
                exception);
        }
    }

    /// <summary>
    /// Walks up from the running assembly's directory to find the repository's <c>web/</c> folder, identified by
    /// its <c>package.json</c>. Resolving from the assembly location keeps this independent of the working
    /// directory the CLI happens to be launched from.
    /// </summary>
    /// <returns>The absolute path to the <c>web/</c> directory.</returns>
    private static string LocateWebDirectory()
    {
        // Start at the bin directory the CLI runs from and climb toward the repo root.
        for (var directory = new DirectoryInfo(AppContext.BaseDirectory);
             directory != null;
             directory = directory.Parent)
        {
            // The repo root is the first ancestor whose web/ subfolder carries a package.json.
            var candidate = Path.Combine(directory.FullName, "web");

            // Found it — hand back the web/ directory.
            if (File.Exists(Path.Combine(candidate, "package.json")))
                return candidate;
        }

        // No ancestor had a web/package.json — the CLI is being run from outside the repo.
        throw new InvalidOperationException(
            $"Could not locate the repository's web/ directory above '{AppContext.BaseDirectory}'. " +
            "Run the CLI from within the MathComps repository.");
    }
}

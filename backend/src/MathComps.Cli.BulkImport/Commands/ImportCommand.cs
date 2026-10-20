using System.ComponentModel;
using System.Globalization;
using MathComps.Cli.BulkImport.Manifest;
using MathComps.Cli.BulkImport.Preflight;
using MathComps.Cli.BulkImport.Validation;
using MathComps.Infrastructure.Services.BulkImport;
using MathComps.Infrastructure.Services.Localization;
using Spectre.Console.Cli;

namespace MathComps.Cli.BulkImport.Commands;

/// <summary>
/// Imports draft folders: checks each draft on its own terms (the TS preflight, then its figures, tag slugs and
/// registry links), and hands a clean one to the <see cref="IDraftImportService"/>. A dry run makes the very same
/// checks and hand-off, so a clean dry run of a folder is a clean import of it into the database as it stands.
/// </summary>
/// <param name="metadata">The metadata service backing the registry-link check.</param>
/// <param name="import">The import itself, dry runs included.</param>
[Description("Import draft folders: write the rows and upload the figures.")]
public class ImportCommand(IMetadataLocalizationService metadata, IDraftImportService import)
    : AsyncCommand<ImportCommand.Settings>
{
    /// <summary>
    /// The command arguments.
    /// </summary>
    public class Settings : CommandSettings
    {
        /// <summary>
        /// Paths and/or globs selecting the draft folder(s) to import.
        /// </summary>
        [CommandArgument(0, "<folders>")]
        [Description("Draft folder path(s) or glob(s) to import. Example: ./my-draft OR 'data/problems/skmo-2025-*'")]
        public required string[] Folders { get; set; }

        /// <summary>
        /// Whether to report what the import would do without keeping or uploading anything.
        /// </summary>
        [CommandOption("--dry-run")]
        [Description("Run every check and report what the import would do. Keeps nothing.")]
        public bool DryRun { get; set; }
    }

    /// <inheritdoc/>
    public override async Task<int> ExecuteAsync(CommandContext context, Settings settings) =>
        // Import every matched folder; the runner owns the glob expansion, per-folder header and tally.
        await MultiFolderRunner.RunAsync(
            settings.Folders, okLabel: settings.DryRun ? "passed" : "imported",
            folder => ImportFolderAsync(folder, settings.DryRun));

    /// <summary>
    /// Checks then imports a single draft folder, rendering its report. Every issue is collected rather than stopping
    /// at the first, and the database is consulted only for a draft clean on its own terms.
    /// </summary>
    /// <param name="folder">The draft-folder path to import.</param>
    /// <param name="dryRun">Whether to keep nothing.</param>
    /// <returns>Whether the folder passed, and so was imported unless this was a dry run.</returns>
    private async Task<bool> ImportFolderAsync(string folder, bool dryRun)
    {
        // One Node subprocess does the whole draft-format read; we consume its manifest.
        var manifest = await PreflightRunner.RunAsync(folder);

        // The draft folder's absolute path.
        var folderPath = Path.GetFullPath(folder);

        // Everything the draft alone can be wrong about.
        var draftIssues = DraftIssues(manifest, folderPath);

        // The folder's result, the database asked only about a draft clean on its own terms.
        var result = await ImportResult.CheckThenImportAsync(
            draftIssues, () => ImportAsync(manifest, folderPath, dryRun));

        // Render the report.
        ImportReport.Render(manifest.Meta, result, dryRun);

        // The folder passes when nothing blocked it.
        return result.Ok;
    }

    /// <summary>
    /// Hands a draft clean on its own terms to the import.
    /// </summary>
    /// <param name="manifest">The preflight manifest, carrying the taxonomy and every problem's content.</param>
    /// <param name="folderPath">The draft folder's absolute path.</param>
    /// <param name="dryRun">Whether to keep nothing.</param>
    /// <returns>What the import did, or would have done.</returns>
    private async Task<DraftImportOutcome> ImportAsync(DraftManifest manifest, string folderPath, bool dryRun)
    {
        // The folder's taxonomy.
        var meta = manifest.Meta;

        // The folder date is a validated YYYY-MM-DD; parse it for the round.
        var date = DateOnly.ParseExact(meta.Date, "yyyy-MM-dd", CultureInfo.InvariantCulture);

        // Each problem's full content, in the shape the import writes.
        var problems = manifest.Problems.Select(problem => problem.Content).ToList();

        // Run the import.
        return await import.ImportAsync(
            new DraftTarget(meta.CompetitionPath, meta.Season.Year, meta.Organization), date, meta.VisibleSinceUtc,
            problems, folderPath, dryRun);
    }

    /// <summary>
    /// Collects every issue a draft has on its own terms: the preflight's, then any figure that can't be sized, any tag
    /// slug outside the approved vocabulary or listed twice and, when its taxonomy is usable, any gap in its registry
    /// links.
    /// </summary>
    /// <param name="manifest">The preflight manifest.</param>
    /// <param name="folderPath">The draft folder's absolute path.</param>
    /// <returns>Every issue found, unordered.</returns>
    private List<VerdictError> DraftIssues(DraftManifest manifest, string folderPath)
    {
        // Start from the preflight's own issues.
        var issues = new List<VerdictError>(manifest.Verdict.Errors);

        // Every referenced image must size cleanly, the exact read the import performs.
        issues.AddRange(ImageRefValidator.Check(manifest.Problems, folderPath));

        // Tag slugs must resolve to the approved vocabulary.
        issues.AddRange(TagSlugValidator.Check(manifest.Problems));

        // An unusable meta has already reported its own error, which the registry check would only bury under
        // empty-slug noise.
        if (manifest.IsMetadataUsable)
            issues.AddRange(RegistryLinkValidator.Check(metadata, manifest.Meta));

        // Every issue the draft has on its own.
        return issues;
    }
}

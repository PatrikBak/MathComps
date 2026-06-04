using System.ComponentModel;
using MathComps.Cli.BulkImport.Manifest;
using MathComps.Cli.BulkImport.Preflight;
using MathComps.Cli.BulkImport.Validation;
using MathComps.Infrastructure.BulkImport;
using MathComps.Infrastructure.Services;
using Spectre.Console.Cli;

namespace MathComps.Cli.BulkImport.Commands;

/// <summary>
/// The dry-run command for the bulk-import pipeline: it checks a draft folder and reports every problem at once
/// without changing anything. It shells out to the TS preflight once for the format and markdown checks, then
/// adds the C# side's read-only checks — registry-link and a database preview of what would be created versus
/// reused — and aggregates all the issues. Writes nothing; the separate import step performs the real changes,
/// so a clean dry run all but guarantees a clean import.
/// </summary>
/// <param name="metadata">The metadata service backing the registry-link check.</param>
/// <param name="resolution">The read-only DB-resolution service backing the create-vs-reuse preview.</param>
[Description("Dry-run a draft folder: TS preflight + registry-link + read-only DB preview. Writes nothing.")]
public class ValidateCommand(
    IMetadataLocalizationService metadata,
    IDraftResolutionService resolution)
    : AsyncCommand<ValidateCommand.Settings>
{
    /// <summary>
    /// The command arguments.
    /// </summary>
    public class Settings : CommandSettings
    {
        /// <summary>
        /// Path to the draft folder to validate.
        /// </summary>
        [CommandArgument(0, "<folder>")]
        [Description("Path to the draft folder to validate.")]
        public required string Folder { get; set; }

        /// <summary>
        /// Emit the structured result as JSON instead of the human-readable report.
        /// </summary>
        [CommandOption("--json")]
        [Description("Emit the structured result as JSON instead of a human-readable report.")]
        public bool Json { get; set; }
    }

    /// <inheritdoc/>
    public override async Task<int> ExecuteAsync(CommandContext context, Settings settings)
    {
        // One Node subprocess does the whole draft-format read; we consume its manifest.
        var manifest = PreflightRunner.Run(settings.Folder);

        // Start from the preflight's own issues, then layer the C# side's findings on top.
        var issues = new List<VerdictError>(manifest.Verdict.Errors);

        // The taxonomy is only worth resolving once the preflight got usable competition + round slugs;
        // otherwise it already reported the meta error and these checks would only echo garbage.
        var metaUsable = !string.IsNullOrWhiteSpace(manifest.Meta.Competition)
            && !string.IsNullOrWhiteSpace(manifest.Meta.Round);

        // Registry-link: every taxonomy slug must be registered structurally and in all three locales.
        if (metaUsable)
            issues.AddRange(RegistryLinkValidator.Check(metadata, manifest.Meta));

        // Read-only DB preview: create-vs-reuse + slug collisions. Best-effort — an unreachable DB degrades to a
        // warning so the format and registry results still come through, no DB required.
        DraftDbPreview? dbPreview = null;
        if (metaUsable)
        {
            try
            {
                // Map the manifest's taxonomy onto the Infrastructure input contract, then preview.
                var target = new DraftTarget(
                    manifest.Meta.Competition, manifest.Meta.Category, manifest.Meta.Round, manifest.Meta.Season.Year);
                dbPreview = await resolution.PreviewAsync(
                    target, [.. manifest.Problems.Select(problem => problem.Order)]);

                // Each problem-slug collision is a warning — importing would overwrite that problem in place.
                issues.AddRange(dbPreview.CollidingProblemSlugs.Select(slug => new VerdictError(
                    "_meta.yaml", Half: null, Line: null, Col: null, "slug-collision",
                    $"problem slug '{slug}' already exists — importing would overwrite it",
                    VerdictSeverity.Warning)));
            }
            catch (Exception exception)
            {
                // No DB reachable — don't fail the whole dry run; note it and let the other results stand.
                issues.Add(new VerdictError(
                    "_meta.yaml", Half: null, Line: null, Col: null, "db-preview",
                    $"DB preview skipped: {exception.Message}", VerdictSeverity.Warning));
            }
        }

        // Order the issues deterministically, then wrap them up — the result derives pass/fail from them itself.
        var ordered = issues.InDisplayOrder();
        var result = new ValidateResult(ordered, dbPreview);

        // Emit machine-readable JSON, or the human report by default.
        if (settings.Json)
            Console.WriteLine(result.ToJson());
        else
            ValidateReport.Render(manifest.Meta, result);

        // Non-zero exit iff an error-severity issue exists.
        return result.Ok ? 0 : 1;
    }
}

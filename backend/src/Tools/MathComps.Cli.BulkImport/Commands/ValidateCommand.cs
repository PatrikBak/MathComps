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

        // Read-only DB preview: create-vs-reuse + per-half import outcomes. Best-effort — an unreachable DB
        // degrades to a warning so the format and registry results still come through, no DB required.
        DraftDbPreview? dbPreview = null;
        if (metaUsable)
        {
            try
            {
                // Map the manifest's taxonomy onto the Infrastructure contract.
                var target = new DraftTarget(
                    manifest.Meta.Competition, manifest.Meta.Category, manifest.Meta.Round,
                    manifest.Meta.Season.Year);

                // Carry each problem's text variants — language, originality and solution presence per text.
                var problemRefs = manifest.Problems
                    .Select(problem => new DraftProblemRef(
                        problem.Order,
                        [.. problem.Texts.Select(text => new DraftTextRef(
                            text.Language, text.Original, text.SolutionMarkdown is not null))]))
                    .ToList();

                // Run the read-only preview: create-vs-reuse plus the per-half import outcomes.
                dbPreview = await resolution.PreviewAsync(target, problemRefs);

                // Turn each per-half resolution that's worth flagging into an issue; clean adds report nothing.
                issues.AddRange(dbPreview.TextResolutions
                    .Select(IssueFor)
                    .Where(issue => issue is not null)
                    .Select(issue => issue!));
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

    /// <summary>
    /// Turns one per-text DB resolution into an issue, or null when it's a clean add not worth surfacing. A
    /// second original is an error; in-place overwrites are warnings.
    /// </summary>
    /// <param name="resolution">The per-text resolution from the DB preview.</param>
    /// <returns>The issue to report, or null for a clean add.</returns>
    private static VerdictError? IssueFor(ProblemTextResolution resolution)
    {
        // The half and language, lower-cased to match the rest of the report.
        var half = resolution.DocumentType.ToString().ToLowerInvariant();
        var language = resolution.Language.ToString().ToLowerInvariant();
        var slug = resolution.Slug;

        // Map each action to its rule, message and severity; clean adds map to null.
        return resolution.Action switch
        {
            DraftTextAction.SecondOriginal => Issue("original-conflict",
                $"problem '{slug}' {half} already has an original in a different language — importing as "
                + "original would create a second original (forbidden)", VerdictSeverity.Error),

            DraftTextAction.OverwriteOriginal => Issue("overwrite",
                $"problem '{slug}' {half} already exists as the {language} original — importing would overwrite "
                + "it in place", VerdictSeverity.Warning),

            DraftTextAction.OverwriteTranslation => Issue("overwrite",
                $"problem '{slug}' {half} already has a {language} text — importing the translation would "
                + "overwrite it in place", VerdictSeverity.Warning),

            // A clean add (new original or new translation) is the expected path — nothing to flag.
            DraftTextAction.AddOriginal or DraftTextAction.AddTranslation => null,

            // Unhandled cases
            _ => throw new ArgumentOutOfRangeException(nameof(resolution), resolution.Action, null)
        };
    }

    /// <summary>
    /// Builds a file-level <c>_meta.yaml</c> issue carrying a DB-preview finding.
    /// </summary>
    /// <param name="rule">The machine-readable rule category.</param>
    /// <param name="message">The human-readable description.</param>
    /// <param name="severity">Whether the finding blocks import or is advisory.</param>
    /// <returns>The assembled issue.</returns>
    private static VerdictError Issue(string rule, string message, VerdictSeverity severity) =>
        new("_meta.yaml", Half: null, Line: null, Col: null, rule, message, severity);
}

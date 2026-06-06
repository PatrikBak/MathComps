using MathComps.Cli.BulkImport.Commands;
using MathComps.Cli.BulkImport.Manifest;
using MathComps.Cli.BulkImport.Preflight;
using MathComps.Infrastructure.BulkImport;
using MathComps.Infrastructure.Services;

namespace MathComps.Cli.BulkImport.Validation;

/// <summary>
/// The read-only validation pipeline shared by both modes: it runs the TS preflight, layers on the C# side's
/// registry-link and read-only DB-preview checks, and aggregates every issue into a <see cref="ValidateResult"/>.
/// <c>validate</c> renders this and stops; <c>apply</c> runs the very same pipeline and only mutates when it comes
/// back clean — so a green dry run can't drift from the real import, because both reach this one code path.
/// </summary>
/// <param name="metadata">The metadata service backing the registry-link check.</param>
/// <param name="resolution">The read-only DB-resolution service backing the create-vs-reuse preview.</param>
public class DraftValidationPipeline(
    IMetadataLocalizationService metadata,
    IDraftResolutionService resolution)
{
    /// <summary>
    /// Validates a draft folder: preflight, then registry-link and the read-only DB preview, with every issue
    /// collected (never fail-fast) and ordered. Writes nothing.
    /// </summary>
    /// <param name="folder">Path to the draft folder.</param>
    /// <returns>The preflight manifest plus the aggregated result (issues + DB preview).</returns>
    public async Task<DraftValidationOutcome> RunAsync(string folder)
    {
        // One Node subprocess does the whole draft-format read; we consume its manifest.
        var manifest = PreflightRunner.Run(folder);

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
                    ManifestMeta.FileName, Half: null, Line: null, Col: null, "db-preview",
                    $"DB preview skipped: {exception.Message}", VerdictSeverity.Warning));
            }
        }

        // Order the issues deterministically, then wrap them up — the result derives pass/fail from them itself.
        var ordered = issues.InDisplayOrder();
        return new DraftValidationOutcome(manifest, new ValidateResult(ordered, dbPreview));
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
        new(ManifestMeta.FileName, Half: null, Line: null, Col: null, rule, message, severity);
}

/// <summary>
/// The output of <see cref="DraftValidationPipeline.RunAsync"/>: the preflight manifest (which carries the content
/// <c>apply</c> needs) paired with the aggregated <see cref="ValidateResult"/> (issues + DB preview).
/// </summary>
/// <param name="Manifest">The whole preflight manifest.</param>
/// <param name="Result">The aggregated validation result, deriving pass/fail from its issues.</param>
public record DraftValidationOutcome(DraftManifest Manifest, ValidateResult Result);

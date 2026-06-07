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
        var manifest = await PreflightRunner.RunAsync(folder);

        // Start from the preflight's own issues, then layer the C# side's findings on top.
        var issues = new List<VerdictError>(manifest.Verdict.Errors);

        // An unusable meta has already reported its own error; hand that verdict straight back rather than
        // letting the registry/DB checks bury it under empty-slug noise.
        if (!manifest.IsMetadataUsable)
            return new DraftValidationOutcome(manifest, new ValidateResult(issues.InDisplayOrder(), null));

        // Registry-link: every taxonomy slug must be registered structurally and in all three locales.
        issues.AddRange(RegistryLinkValidator.Check(metadata, manifest.Meta));

        // Read-only DB preview: create-vs-reuse plus the per-half import outcomes.
        var (dbPreview, dbIssues) = await PreviewDbAsync(manifest, folder);

        // Fold the preview's flagged outcomes into the issue list.
        issues.AddRange(dbIssues);

        // Order the issues deterministically, then wrap them up — the result derives pass/fail from them itself.
        return new DraftValidationOutcome(manifest, new ValidateResult(issues.InDisplayOrder(), dbPreview));
    }

    /// <summary>
    /// Runs the read-only DB preview for a resolvable draft and maps its per-half resolutions to the issues
    /// worth flagging. Best-effort: an unreachable database degrades to a single warning so the format and
    /// registry results still stand, instead of failing the dry run.
    /// </summary>
    /// <param name="manifest">The preflight manifest whose taxonomy and problems are previewed.</param>
    /// <param name="folder">The draft folder, against which the preview reproduces image references.</param>
    /// <returns>The preview (null when the database was unreachable) and the issues it produced.</returns>
    private async Task<(DraftDbPreview? Preview, IReadOnlyList<VerdictError> Issues)> PreviewDbAsync(
        DraftManifest manifest, string folder)
    {
        try
        {
            // Map the manifest's taxonomy onto the Infrastructure contract.
            var target = new DraftTarget(
                manifest.Meta.Competition, manifest.Meta.Category, manifest.Meta.Round,
                manifest.Meta.Season.Year);

            // Carry each problem's full content — the preview reproduces the bodies the import would store, so it
            // needs the markdown and images, not just the shape.
            var problems = manifest.Problems
                .Select(problem => new DraftProblemContent(
                    problem.Order,
                    problem.Authors,
                    problem.SolutionLink,
                    [.. problem.Texts.Select(text => new DraftTextContent(
                        text.Language, text.Original, text.StatementMarkdown, text.SolutionMarkdown))],
                    problem.Images))
                .ToList();

            // Run the read-only preview.
            var preview = await resolution.PreviewAsync(target, problems, Path.GetFullPath(folder));

            // Keep only the per-half resolutions worth flagging.
            var previewIssues = preview.TextResolutions
                .Select(IssueFor)
                .Where(issue => issue is not null)
                .Select(issue => issue!)
                .ToList();
            return (preview, previewIssues);
        }
        catch (Exception exception)
        {
            // No DB reachable — don't fail the whole dry run; note it and let the other results stand.
            return (null, [new VerdictError(
                ManifestMeta.FileName, Half: null, Line: null, Col: null, "db-preview",
                $"DB preview skipped: {exception.Message}", VerdictSeverity.Warning)]);
        }
    }

    /// <summary>
    /// Turns one per-text DB resolution into an issue, or null when the outcome is routine. Only a second original
    /// (a forbidden different-language original) blocks the import; adds, unchanged re-imports and intentional
    /// in-place overwrites are routine outcomes the report records without alarm.
    /// </summary>
    /// <param name="resolution">The per-text resolution from the DB preview.</param>
    /// <returns>The blocking issue, or null for a routine outcome.</returns>
    private static VerdictError? IssueFor(ProblemTextResolution resolution)
    {
        // The half, lower-cased to match the rest of the report.
        var half = resolution.DocumentType.ToString().ToLowerInvariant();
        var slug = resolution.Slug;

        // Only a second original blocks; everything else is a routine outcome the report already records.
        return resolution.Action switch
        {
            DraftTextAction.SecondOriginal => new VerdictError(
                ManifestMeta.FileName, Half: null, Line: null, Col: null, "original-conflict",
                $"problem '{slug}' {half} already has an original in a different language — importing as "
                + "original would create a second original (forbidden)", VerdictSeverity.Error),

            // Adds, unchanged re-imports and intentional in-place overwrites are all expected — nothing to flag.
            DraftTextAction.AddOriginal or DraftTextAction.AddTranslation
                or DraftTextAction.UnchangedOriginal or DraftTextAction.UnchangedTranslation
                or DraftTextAction.OverwriteOriginal or DraftTextAction.OverwriteTranslation => null,

            // Unhandled cases.
            _ => throw new ArgumentOutOfRangeException(nameof(resolution), resolution.Action, null)
        };
    }
}

/// <summary>
/// The output of <see cref="DraftValidationPipeline.RunAsync"/>: the preflight manifest (which carries the content
/// <c>apply</c> needs) paired with the aggregated <see cref="ValidateResult"/> (issues + DB preview).
/// </summary>
/// <param name="Manifest">The whole preflight manifest.</param>
/// <param name="Result">The aggregated validation result, deriving pass/fail from its issues.</param>
public record DraftValidationOutcome(DraftManifest Manifest, ValidateResult Result);

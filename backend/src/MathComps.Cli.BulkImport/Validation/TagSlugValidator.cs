using MathComps.Cli.BulkImport.Manifest;
using MathComps.Domain.Tagging;

namespace MathComps.Cli.BulkImport.Validation;

/// <summary>
/// Validates each problem's draft tag slugs against the approved vocabulary. The <c>tags:</c> list is hand-editable on
/// the localhost-render review step, so the by-construction guarantee from <c>tag-draft</c> can be voided by a typo;
/// this is the authoritative gate that a slug exists before apply turns it into a row. Runs in C# (not the Node
/// preflight) because the vocabulary resolver lives in <c>MathComps.Shared</c>.
/// </summary>
public static class TagSlugValidator
{
    /// <summary>
    /// Checks every problem's tag slugs: an unknown slug is a blocking error, a repeated slug a warning. Problems
    /// with no <c>tags:</c> key (null) are skipped — there is nothing to validate.
    /// </summary>
    /// <param name="problems">The manifest's problems.</param>
    /// <returns>One issue per offending slug, against the problem's <c>pN.yaml</c>.</returns>
    public static IReadOnlyList<VerdictError> Check(IEnumerable<ManifestProblem> problems) =>
        [.. problems.SelectMany(CheckProblem)];

    /// <summary>
    /// Validates one problem's tag slugs.
    /// </summary>
    /// <param name="problem">The problem to check.</param>
    /// <returns>The slug issues for this problem, in slug order.</returns>
    private static IEnumerable<VerdictError> CheckProblem(ManifestProblem problem)
    {
        // No tags key — nothing to validate (null leaves existing tags untouched).
        if (problem.Tags is not { } tags)
            return [];

        // Every issue for this problem points at its sidecar.
        var file = $"p{problem.Order}.yaml";

        // Every slug outside the approved vocabulary is a blocking error.
        var unknown = tags
            .Where(slug => !TagVocabulary.IsKnownSlug(slug))
            .Distinct()
            .Select(slug => Issue(file, $"unknown tag slug '{slug}' — not in the approved vocabulary", VerdictSeverity.Error));

        // A slug listed more than once is harmless but worth flagging. Group on the canonical form so two casings of
        // one slug are caught here — apply collapses them to a single row, so the reviewer should know.
        var duplicates = tags
            .GroupBy(TagVocabulary.Canonicalize)
            .Where(group => group.Count() > 1)
            .Select(group => Issue(file, $"tag slug '{group.Key}' is listed more than once", VerdictSeverity.Warning));

        // This problem's issues: unknown-slug errors followed by duplicate warnings.
        return unknown.Concat(duplicates);
    }

    /// <summary>
    /// Builds a file-level tag issue against a problem's sidecar.
    /// </summary>
    /// <param name="file">The <c>pN.yaml</c> the issue belongs to.</param>
    /// <param name="message">The human-readable description.</param>
    /// <param name="severity">Whether the issue blocks import.</param>
    /// <returns>The issue with rule <c>tags</c>.</returns>
    private static VerdictError Issue(string file, string message, VerdictSeverity severity) =>
        new(file, Half: null, Line: null, Col: null, "tags", message, severity);
}

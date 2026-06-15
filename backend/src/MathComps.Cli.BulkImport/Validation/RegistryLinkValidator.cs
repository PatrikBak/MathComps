using MathComps.Cli.BulkImport.Manifest;
using MathComps.Infrastructure.Services.Localization;
using MathComps.Domain.Taxonomy;
using MathComps.Domain.Resources;
using MathComps.Shared.Extensions;

namespace MathComps.Cli.BulkImport.Validation;

/// <summary>
/// Turns the metadata service's registry-link findings into the canonical <see cref="VerdictError"/> shape, so
/// an unregistered or partly-localized taxonomy slug reads like any other preflight error.
/// </summary>
public static class RegistryLinkValidator
{
    /// <summary>
    /// Runs the registry-link check for a draft's taxonomy and maps every gap to an error-severity issue against
    /// <c>_meta.yaml</c>.
    /// </summary>
    /// <param name="metadata">The metadata service holding the shared structure and all locale maps.</param>
    /// <param name="meta">The draft's folder-level taxonomy.</param>
    /// <returns>
    /// One issue per slug with a registry gap, or an empty list when the taxonomy is fully registered.
    /// </returns>
    public static IReadOnlyList<VerdictError> Check(IMetadataLocalizationService metadata, ManifestMeta meta) =>
        [.. metadata
            .ValidateTaxonomyRegistration(meta.Competition, meta.Category, meta.Round)
            .Select(ToVerdictError)];

    /// <summary>
    /// Renders a single registry-link issue as a <see cref="VerdictError"/>, describing both the structural gap
    /// (absent from <see cref="ResourcePaths.SharedMetadataFileName"/>) and the localization gap (missing names
    /// in some locales).
    /// </summary>
    /// <param name="issue">The registry-link gap to map.</param>
    /// <returns>An error-severity issue against <c>_meta.yaml</c> with rule <c>registry</c>.</returns>
    public static VerdictError ToVerdictError(TaxonomyRegistryIssue issue)
    {
        // Describe whichever gaps this slug has — it may be missing structurally, in some locales, or both.
        var gaps = new List<string>();

        // The structural backbone is missing the slug entirely.
        if (issue.MissingFromSharedStructure)
            gaps.Add($"no structural entry in {ResourcePaths.SharedMetadataFileName}");

        // Some locales carry no localized name for it.
        if (issue.MissingLocales.Length > 0)
        {
            var locales = issue.MissingLocales.Select(language => language.ToString().ToLowerInvariant());
            gaps.Add($"no localized name in {locales.ToJoinedString()}");
        }

        // Compose a single readable message, e.g. "round 'csmo-a-iii' has no localized name in cs, en".
        var kind = issue.EntityKind.ToString().ToLowerInvariant();
        var message = $"{kind} '{issue.Identifier}' has {gaps.ToJoinedString("; ")}";

        // Registry gaps are folder-level and always blocking.
        return new VerdictError(
            ManifestMeta.FileName, Half: null, Line: null, Col: null, "registry", message, VerdictSeverity.Error);
    }
}

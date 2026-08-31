using MathComps.Cli.BulkImport.Manifest;
using MathComps.Infrastructure.Services.Localization;

namespace MathComps.Cli.BulkImport.Validation;

/// <summary>
/// Turns the metadata service's registry-link findings into the canonical <see cref="VerdictError"/> shape, so
/// an unregistered or partly-localized competition reads like any other preflight error.
/// </summary>
public static class RegistryLinkValidator
{
    /// <summary>
    /// Runs the registry-link check for a draft's competition and maps every gap to an error-severity issue against
    /// <c>_meta.yaml</c>.
    /// </summary>
    /// <param name="metadata">The metadata service holding the shared structure and all locale maps.</param>
    /// <param name="meta">The draft's folder-level taxonomy.</param>
    /// <returns>
    /// One issue per competition with a registry gap, or an empty list when the competition is fully registered.
    /// </returns>
    public static IReadOnlyList<VerdictError> Check(IMetadataLocalizationService metadata, ManifestMeta meta) =>
        // Ask the registry for the competition's gaps, and shape each one as a folder-level blocking error. The
        // gap composes its own clause, e.g. "competition 'csmo-a-iii' has no localized name in cs, en".
        [
            .. metadata.ValidateTaxonomyRegistration(meta.CompetitionPath)
                .Select(issue => new VerdictError(
                    ManifestMeta.FileName, Half: null, Line: null, Col: null, "registry",
                    $"competition '{issue.Path}' has {issue.Gaps}", VerdictSeverity.Error))
        ];
}

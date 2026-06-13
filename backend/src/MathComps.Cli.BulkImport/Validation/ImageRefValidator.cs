using MathComps.Cli.BulkImport.Manifest;
using MathComps.Infrastructure.BulkImport;

namespace MathComps.Cli.BulkImport.Validation;

/// <summary>
/// Checks that every image a draft references resolves to readable intrinsic dimensions — the same read
/// <c>apply</c> performs when it sizes and uploads each figure. It runs in the shared validation as a hard error so
/// that a green <c>validate</c> guarantees a green <c>apply</c>: a draft carrying an unreadable or wrong-format
/// figure is rejected up front, before any upload or write, rather than only surfacing mid-import.
/// </summary>
public static class ImageRefValidator
{
    /// <summary>The subfolder every draft keeps its image assets in.</summary>
    private const string ImagesFolder = "images";

    /// <summary>
    /// Validates every distinct image referenced across the draft's problems, mapping any that can't be sized to an
    /// error-severity issue against its <c>images/&lt;name&gt;</c> path. Reads dimensions only; writes nothing, and
    /// needs neither the database nor the taxonomy.
    /// </summary>
    /// <param name="problems">The draft's problems, each carrying the basenames it references.</param>
    /// <param name="folder">The draft folder the image refs resolve against.</param>
    /// <returns>One issue per unreadable image, or an empty list when every figure sizes cleanly.</returns>
    public static IReadOnlyList<VerdictError> Check(IReadOnlyList<ManifestProblem> problems, string folder) =>
        [.. problems
            .SelectMany(problem => problem.Images)
            .Distinct()
            .Select(basename => Validate(basename, folder))
            .Where(issue => issue is not null)
            .Select(issue => issue!)];

    /// <summary>
    /// Tries to size one image, returning the issue it raises or null when it reads cleanly. A reference that
    /// doesn't exist on disk is left to the preflight's own <c>missing-image</c> check rather than reported twice.
    /// </summary>
    /// <param name="basename">The image basename under <c>images/</c>.</param>
    /// <param name="folder">The draft folder.</param>
    /// <returns>The blocking issue, or null when the image sizes (or is absent — preflight owns that).</returns>
    private static VerdictError? Validate(string basename, string folder)
    {
        // A missing file is the preflight's to report; skip it here so one absent image isn't flagged twice.
        var path = Path.Combine(folder, ImagesFolder, basename);
        if (!File.Exists(path))
            return null;

        try
        {
            // The same read apply will perform — an unsupported format or a sizeless file throws here, well before
            // any upload or write.
            _ = ImageDimensions.Read(path);
            return null;
        }
        catch (Exception exception) when (exception is InvalidOperationException or IOException)
        {
            // Attribute the failure to the figure itself so the author sees exactly which file to fix.
            return new VerdictError(
                $"{ImagesFolder}/{basename}", Half: null, Line: null, Col: null,
                "image", exception.Message, VerdictSeverity.Error);
        }
    }
}

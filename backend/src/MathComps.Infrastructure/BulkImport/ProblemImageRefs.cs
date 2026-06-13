namespace MathComps.Infrastructure.BulkImport;

/// <summary>
/// Builds the relative-ref → <c>media:</c> ref map a problem's markdown is rewritten against. The map is fully
/// determined by the problem slug and the images' intrinsic dimensions, so it can be reproduced without uploading —
/// the apply path builds it and then uploads, the read-only preview builds it only to compare content.
/// </summary>
public static class ProblemImageRefs
{
    /// <summary>
    /// The media content id for one image: the slug keeps it stable across edits, the filename stem disambiguates
    /// within a problem. Extension-less for every format, so the whole corpus shares one key shape; two images in one
    /// problem must not share a stem, which keeps the bare key unambiguous.
    /// </summary>
    /// <param name="slug">The owning problem's slug.</param>
    /// <param name="basename">The image's basename (under <c>images/</c>).</param>
    /// <returns>The content id, e.g. <c>"75-csmo-b-ii-1-incircle"</c>.</returns>
    public static string ContentId(string slug, string basename) =>
        $"{slug}-{Path.GetFileNameWithoutExtension(basename)}";

    /// <summary>
    /// Builds the relative-ref → resolved <c>media:</c> ref map for a problem's images, reading each image's
    /// intrinsic dimensions off disk so they ride along in the query string. Writes nothing.
    /// </summary>
    /// <param name="images">The image basenames the problem references.</param>
    /// <param name="slug">The owning problem's slug, the content-id prefix.</param>
    /// <param name="draftFolder">The draft folder the relative refs resolve against.</param>
    /// <returns>The relative-ref → media-ref replacements for the markdown rewrite.</returns>
    public static Dictionary<string, string> BuildReplacements(
        IEnumerable<string> images, string slug, string draftFolder)
    {
        // Ordinal keys — the refs are exact path tokens, not culture-sensitive text.
        var replacements = new Dictionary<string, string>(StringComparer.Ordinal);

        // Each referenced basename becomes one rewrite entry.
        foreach (var basename in images)
        {
            // The relative ref as it appears in the markdown — the key the rewrite replaces.
            var relativeRef = $"images/{basename}";

            // The file on disk that ref points at, and its intrinsic dimensions (SVG or raster, by extension).
            var localPath = Path.Combine(draftFolder, "images", basename);
            var (width, height) = ImageDimensions.Read(localPath);

            // The resolved ref the markdown will point at — dimensions ride along in the query string.
            replacements[relativeRef] = $"media:{ContentId(slug, basename)}?width={width}&height={height}";
        }

        // The full map; a body that uses only some of the images simply leaves the rest unmatched.
        return replacements;
    }
}

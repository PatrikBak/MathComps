using MathComps.Infrastructure.Imaging;
using MathComps.Shared.Io;

namespace MathComps.Infrastructure.Services.BulkImport;

/// <summary>
/// A draft image ref resolved to the figure's content id and its intrinsic pixel dimensions.
/// </summary>
/// <param name="ContentId">
/// The name the figure is stored and referenced under, e.g. <c>75-csmo-b-ii-1-3f2a9c1b7d4e8a60</c>: the problem's slug,
/// then a hash of the figure's bytes. The hash is what keeps a figure of a problem nobody may see yet out of reach,
/// since public storage never lists its files and the name can't be worked out without the file. It also gives a
/// redrawn figure a new name, while an unchanged one keeps its old name across re-imports.
/// </param>
/// <param name="Width">The figure's intrinsic width in whole pixels.</param>
/// <param name="Height">The figure's intrinsic height in whole pixels.</param>
public readonly record struct ResolvedImageRef(string ContentId, int Width, int Height)
{
    /// <summary>
    /// The bare <c>media:</c> ref, without a query string, e.g. <c>media:75-csmo-b-ii-1-3f2a9c1b7d4e8a60</c>.
    /// </summary>
    public string MediaKey => $"media:{ContentId}";
}

/// <summary>
/// Builds a problem's map from each relative figure ref to its <see cref="ResolvedImageRef"/>. The map is fully
/// determined by the problem slug and the image files on disk, so it is
/// known before anything uploads, and a dry run rewrites every body exactly as the real import does.
/// </summary>
public static class ProblemImageRefs
{
    /// <summary>
    /// How many leading hex digits of the figure's content hash its name keeps: 64 bits, far past what anyone could try
    /// against storage one request at a time.
    /// </summary>
    private const int NameHashLength = 16;

    /// <summary>
    /// Builds the relative-ref → <see cref="ResolvedImageRef"/> map for a problem's images, reading each image's
    /// intrinsic dimensions and content hash off disk. Writes nothing.
    /// </summary>
    /// <param name="images">The image basenames the problem references.</param>
    /// <param name="slug">The owning problem's slug, the content-id prefix.</param>
    /// <param name="draftFolder">The draft folder the relative refs resolve against.</param>
    /// <returns>Each relative ref mapped to its resolved ref.</returns>
    public static Dictionary<string, ResolvedImageRef> BuildReplacements(
        IEnumerable<string> images, string slug, string draftFolder)
    {
        // Ordinal keys — the refs are exact path tokens, not culture-sensitive text.
        var replacements = new Dictionary<string, ResolvedImageRef>(StringComparer.Ordinal);

        // Each referenced basename becomes one rewrite entry.
        foreach (var basename in images)
        {
            // The relative ref as it appears in the markdown — the key the rewrite replaces.
            var relativeRef = $"images/{basename}";

            // The file on disk that ref points at, and its intrinsic dimensions (SVG or raster, by extension).
            var localPath = Path.Combine(draftFolder, "images", basename);
            var (width, height) = ImageDimensions.Read(localPath);

            // The hash of the figure's bytes its name ends in.
            var nameHash = FileUtilities.HashFile(localPath)[..NameHashLength];

            // The content id: the slug keeps it apart from every other problem's figures, and the hash from this
            // problem's other figures and from older drawings of this one. Two images of one problem holding the same
            // bytes share it, being the same file.
            var contentId = $"{slug}-{nameHash}";

            // The resolved ref: the content id plus the figure's dimensions.
            replacements[relativeRef] = new ResolvedImageRef(contentId, width, height);
        }

        // The full map; a body that uses only some of the images simply leaves the rest unmatched.
        return replacements;
    }
}

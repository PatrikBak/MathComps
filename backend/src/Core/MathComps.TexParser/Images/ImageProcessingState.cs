using System.Collections.Immutable;

namespace MathComps.TexParser.Images;

/// <summary>
/// Immutable state for image processing, threaded through tree traversal.
/// Can be passed between multiple <see cref="TexImageProcessor.Process"/> calls
/// to maintain consistent numbering and deduplication across multiple texts.
/// </summary>
/// <param name="Counter">Running counter used to suffix image files.</param>
/// <param name="ProcessedImages">Dictionary mapping source image IDs to their output filenames for deduplication.</param>
/// <param name="DiscoveredImages">Collected metadata for all discovered images.</param>
public record ImageProcessingState(
    int Counter,
    ImmutableDictionary<string, string> ProcessedImages,
    ImmutableList<ImageData> DiscoveredImages
)
{
    /// <summary>
    /// Creates a new initial state with counter starting at 1.
    /// </summary>
    /// <returns>A new <see cref="ImageProcessingState"/> with default values.</returns>
    public static ImageProcessingState Initial => new(
        Counter: 1,
        ProcessedImages: ImmutableDictionary<string, string>.Empty,
        DiscoveredImages: []
    );

    /// <summary>
    /// Resets image collection while preserving counter and processed images.
    /// Useful when chaining multiple texts where you want shared deduplication
    /// but separate image lists per text.
    /// </summary>
    /// <returns>A new <see cref="ImageProcessingState"/> with the same counter and 
    /// processed images, but an empty image list.</returns>
    public ImageProcessingState ResetImages() => this with { DiscoveredImages = [] };
}

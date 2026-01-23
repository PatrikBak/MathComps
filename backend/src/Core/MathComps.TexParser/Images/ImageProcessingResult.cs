using System.Collections.Immutable;
using TexText = MathComps.TexParser.Types.Text;

namespace MathComps.TexParser.Images;

/// <summary>
/// The result of processing images within a parsed <see cref="TexText"/> block.
/// </summary>
/// <param name="ProcessedText">The updated <see cref="TexText"/> object with image IDs replaced by stable content IDs.</param>
/// <param name="DiscoveredImages">A list of the physical <see cref="ImageData"/> discovered during processing.</param>
/// <param name="State">The final processing state, which can be passed to subsequent calls for chaining.</param>
public record ImageProcessingResult(
    TexText ProcessedText,
    ImmutableList<ImageData> DiscoveredImages,
    ImageProcessingState State
);

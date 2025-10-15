using System.Collections.Immutable;
using TexText = MathComps.TexParser.Types.Text;

namespace MathComps.Cli.DatabaseSeeder;

/// <summary>
/// The result of processing images within a parsed text block.
/// </summary>
/// <param name="ProcessedText">The updated Text object with image IDs replaced by stable content IDs.</param>
/// <param name="DiscoveredImages">A list of the physical image data discovered during processing.</param>
public record ProblemImageProcessingResult(TexText? ProcessedText, ImmutableList<ProblemImageData> DiscoveredImages);

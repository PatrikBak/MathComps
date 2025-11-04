namespace MathComps.TexParser.Images;

/// <summary>
/// Holds discovered image metadata calculated by <see cref="TexImageProcessor"/>
/// </summary>
/// <param name="ContentId">The unique, generated filename for the image (e.g., "algebra-1-rozklady-1.svg").</param>
/// <param name="Width">The intrinsic width as declared in SVG (with units).</param>
/// <param name="Height">The intrinsic height as declared in SVG (with units).</param>
/// <param name="Scale">The scaling factor specified in content for this image.</param>
public record ImageData(string ContentId, string Width, string Height, decimal Scale);

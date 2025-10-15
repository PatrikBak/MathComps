namespace MathComps.Domain.ApiDtos.ProblemQuery;

/// <summary>
/// Represents the metadata for a single image associated with a problem.
/// </summary>
/// <param name="ContentId">
/// A stable identifier used to link the image to its placeholder in the problem content.
/// This ID also serves as the image's unique filename (relative URL).
/// </param>
/// <param name="Width">The intrinsic width of the image as declared in SVG (with units).</param>
/// <param name="Height">The intrinsic height of the image as declared in SVG (with units).</param>
/// <param name="Scale">The scaling factor specified in content for this image (1.0 = original).</param>
public record ProblemImageDto(
    string ContentId,
    string Width,
    string Height,
    decimal Scale
);

using System.ComponentModel.DataAnnotations;

namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// Represents a physical image file associated with a problem. We only
/// store its content id based on which we can identify the URL/Path, and its
/// dimensions for showing correctly-sized placeholders.
/// </summary>
public class ProblemImage
{
    /// <summary>
    /// Primary key.
    /// </summary>
    public Guid Id { get; set; } = Guid.CreateVersion7();

    /// <summary>
    /// A stable, sequential identifier for the image within the context of a single problem
    /// (e.g., "image-1", "image-2"). This is used to link the image metadata to the
    /// placeholder in the parsed JSON content.
    /// </summary>
    [MaxLength(100)]
    public required string ContentId { get; set; }

    /// <summary>
    /// The intrinsic width of the image as declared in the SVG (preserves units like px, pt, cm).
    /// </summary>
    public string Width { get; set; } = null!;

    /// <summary>
    /// The intrinsic height of the image as declared in the SVG (preserves units like px, pt, cm).
    /// </summary>
    public string Height { get; set; } = null!;

    /// <summary>
    /// The scaling factor specified in the parsed content for this image (1.0 means original size).
    /// </summary>
    public decimal Scale { get; set; }

    /// <summary>
    /// The foreign key referencing the problem this image belongs to.
    /// </summary>
    public Guid ProblemId { get; set; }

    /// <summary>
    /// Navigation property to the parent problem.
    /// </summary>
    public Problem Problem { get; set; } = null!;
}

using System.ComponentModel.DataAnnotations;

namespace MathComps.Infrastructure.Options;

/// <summary>
/// Settings for reading a photo of a handwritten page: the model call that reads it, how the page is prepared before
/// the model sees it, and how the figures are cut out. The annotations make a missing <c>PhotoReader</c> section
/// fail validation.
/// </summary>
public class PhotoReaderSettings
{
    /// <summary>
    /// Configuration section name for these settings.
    /// </summary>
    public const string SectionName = "PhotoReader";

    /// <summary>
    /// The pixels in a megapixel.
    /// </summary>
    private const long PixelsPerMegapixel = 1_000_000;

    /// <summary>
    /// The reading step: writes out the page and finds its drawings.
    /// </summary>
    [Required]
    public required ChatStepSettings Reading { get; set; }

    /// <summary>
    /// The most pixels the page keeps along its longer side once turned upright; a larger photo is shrunk to it.
    /// </summary>
    [Range(1, int.MaxValue)]
    public required int LongEdge { get; set; }

    /// <summary>
    /// The JPEG quality the page and its figures are encoded at, from 1 to 100.
    /// </summary>
    [Range(1, 100)]
    public required int JpegQuality { get; set; }

    /// <summary>
    /// How far each figure is cut beyond the box the model gives it, on every side, in the box's own units of a
    /// thousandth of the page. The model's boxes sit tight, so without it a dashed line or a label at the edge is lost.
    /// </summary>
    [Range(0, 1000)]
    public required int CropMargin { get; set; }

    /// <summary>
    /// The most megapixels a photo's decode may hold, which bounds the memory the decode takes; a photo whose decode
    /// would pass it is refused as unreadable.
    /// </summary>
    [Range(1, int.MaxValue)]
    public required int MaxDecodedMegapixels { get; set; }

    /// <summary>
    /// <see cref="MaxDecodedMegapixels"/> in pixels.
    /// </summary>
    public long MaxDecodedPixels => MaxDecodedMegapixels * PixelsPerMegapixel;
}

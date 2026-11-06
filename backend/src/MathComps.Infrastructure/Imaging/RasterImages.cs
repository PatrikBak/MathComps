using SkiaSharp;

namespace MathComps.Infrastructure.Imaging;

/// <summary>
/// Decodes a raster image file into an upright bitmap ready to show or cut up, and cuts JPEGs out of a bitmap. Built
/// on SkiaSharp.
/// </summary>
public static class RasterImages
{
    /// <summary>
    /// The encoded formats <see cref="DecodeUpright"/> reads.
    /// </summary>
    private static readonly HashSet<SKEncodedImageFormat> _readableFormats =
        [SKEncodedImageFormat.Jpeg, SKEncodedImageFormat.Png, SKEncodedImageFormat.Webp];

    /// <summary>
    /// Decodes a JPEG, PNG or WebP image the way it is meant to be seen: turned by its EXIF orientation, which a phone
    /// camera writes instead of rotating the pixels, shrunk so its longer side is at most <paramref name="longEdge"/>
    /// (never enlarged), and laid onto white, so a transparent background comes out white. A JPEG or WebP is decoded
    /// at the smallest eighth of its stored size that still covers the long edge, so an image far past the long edge
    /// decodes at a fraction of its size; a PNG can't be decoded smaller and decodes whole.
    /// </summary>
    /// <param name="data">The encoded image file's bytes.</param>
    /// <param name="longEdge">The most pixels the result may have along its longer side.</param>
    /// <param name="maxPixels">The most pixels the decode may hold; a file that would decode to more is refused, since
    /// a small file can declare a size that takes gigabytes to decode.</param>
    /// <returns>The upright, opaque bitmap, or null when the bytes are not a JPEG, PNG or WebP image that can be read,
    /// or would decode to more than <paramref name="maxPixels"/> pixels.</returns>
    public static SKBitmap? DecodeUpright(ReadOnlySpan<byte> data, int longEdge, long maxPixels)
    {
        // Parse the file's header, which yields nothing for bytes that are no image at all.
        using var encoded = SKData.CreateCopy(data);
        using var codec = SKCodec.Create(encoded);

        // An unreadable file, or a format outside the readable ones, is refused.
        if (codec is null || !_readableFormats.Contains(codec.EncodedFormat))
            return null;

        // The longer side the decode must keep: the long edge, or the image's own when it is smaller.
        var neededSide = Math.Min(longEdge, Math.Max(codec.Info.Width, codec.Info.Height));

        // The eighths a JPEG decodes smaller in, the finest it offers.
        const int scaleSteps = 8;

        // The smallest eighth of the stored size that still keeps that side; the stored size, the last eighth, always
        // does.
        var decodedSize = Enumerable.Range(1, scaleSteps)
            .Select(step => codec.GetScaledDimensions((float)step / scaleSteps))
            .First(size => Math.Max(size.Width, size.Height) >= neededSide);

        // A file that would decode past the cap is refused before any pixel is decoded.
        if ((long)decodedSize.Width * decodedSize.Height > maxPixels)
            return null;

        // A bitmap for the decoded pixels, premultiplied.
        using var decoded = new SKBitmap(codec.Info.WithSize(decodedSize).WithAlphaType(SKAlphaType.Premul));

        // Decode the pixels, refusing a file whose body is broken or cut short, which would otherwise come out with its
        // missing rows filled in.
        if (codec.GetPixels(decoded.Info, decoded.GetPixels()) != SKCodecResult.Success)
            return null;

        // The decode is never changed again, which lets it be drawn without copying its pixels.
        decoded.SetImmutable();

        // The size the pixels are decoded at, still turned the way they are stored.
        var (decodedWidth, decodedHeight) = (decoded.Width, decoded.Height);

        // The size once turned upright: a quarter turn either way swaps the two sides.
        var (uprightWidth, uprightHeight) = codec.EncodedOrigin.SwapsSides
            ? (decodedHeight, decodedWidth)
            : (decodedWidth, decodedHeight);

        // How much the upright image shrinks so its longer side fits the long edge, leaving a smaller one as it is.
        var scale = Math.Min(1.0, (double)longEdge / Math.Max(uprightWidth, uprightHeight));

        // The result's size, never below one pixel a side.
        var width = Math.Max(1, (int)Math.Round(uprightWidth * scale));
        var height = Math.Max(1, (int)Math.Round(uprightHeight * scale));

        // The result.
        var upright = new SKBitmap(width, height);

        // A canvas drawing onto the result.
        using var canvas = new SKCanvas(upright);

        // Lay the result onto white before anything is drawn over it.
        canvas.Clear(SKColors.White);

        // Every decoded pixel lands turned upright and then scaled to the result's size.
        canvas.SetMatrix(SKMatrix.CreateScale((float)width / uprightWidth, (float)height / uprightHeight)
            .PreConcat(UprightTransform(codec.EncodedOrigin, decodedWidth, decodedHeight)));

        // Draw the decoded pixels through that transform, in one pass.
        using var decodedImage = SKImage.FromBitmap(decoded);
        canvas.DrawImage(decodedImage, 0, 0, new SKSamplingOptions(SKFilterMode.Linear, SKMipmapMode.Linear));

        // Hand back the upright bitmap.
        return upright;
    }

    /// <summary>
    /// Encodes one rectangle of a bitmap as a JPEG.
    /// </summary>
    /// <param name="bitmap">The bitmap to cut from.</param>
    /// <param name="area">The rectangle to keep, in the bitmap's pixels; only the part on the bitmap is kept, and the
    /// whole bitmap keeps everything.</param>
    /// <param name="quality">The JPEG quality, from 1 to 100.</param>
    /// <returns>The JPEG file's bytes.</returns>
    /// <exception cref="ArgumentOutOfRangeException">Thrown when the rectangle holds none of the bitmap.</exception>
    public static byte[] EncodeJpeg(SKBitmap bitmap, SKRectI area, int quality)
    {
        // The cut, which shares the bitmap's pixels.
        using var cut = new SKBitmap();

        // Cut the rectangle's part of the bitmap, refusing a rectangle that lies wholly off it.
        if (!bitmap.ExtractSubset(cut, area))
            throw new ArgumentOutOfRangeException(nameof(area), area, "The area holds none of the bitmap.");

        // Encode the cut as a JPEG.
        using var jpeg = cut.Encode(SKEncodedImageFormat.Jpeg, quality);

        // Hand back the JPEG's bytes.
        return jpeg.ToArray();
    }

    extension(SKEncodedOrigin origin)
    {
        /// <summary>
        /// Whether the orientation turns the stored pixels a quarter turn, with or without a mirror, so the upright
        /// image's width is the stored height.
        /// </summary>
        private bool SwapsSides => origin switch
        {
            SKEncodedOrigin.TopLeft or SKEncodedOrigin.TopRight
                or SKEncodedOrigin.BottomRight or SKEncodedOrigin.BottomLeft => false,
            SKEncodedOrigin.LeftTop or SKEncodedOrigin.RightTop
                or SKEncodedOrigin.RightBottom or SKEncodedOrigin.LeftBottom => true,
            _ => throw new ArgumentOutOfRangeException(nameof(origin), origin, "Unknown EXIF orientation"),
        };
    }

    /// <summary>
    /// The transform taking a pixel as stored to where it sits once the image is turned upright, for each EXIF
    /// orientation: a mirror, a turn, or both.
    /// </summary>
    /// <param name="origin">The orientation the file was stored with.</param>
    /// <param name="width">The image's width in pixels, before it is turned.</param>
    /// <param name="height">The image's height in pixels, before it is turned.</param>
    /// <returns>The transform from stored to upright pixel positions.</returns>
    private static SKMatrix UprightTransform(SKEncodedOrigin origin, int width, int height) => origin switch
    {
        SKEncodedOrigin.TopLeft => SKMatrix.Identity,
        SKEncodedOrigin.TopRight => new SKMatrix(-1, 0, width, 0, 1, 0, 0, 0, 1),
        SKEncodedOrigin.BottomRight => new SKMatrix(-1, 0, width, 0, -1, height, 0, 0, 1),
        SKEncodedOrigin.BottomLeft => new SKMatrix(1, 0, 0, 0, -1, height, 0, 0, 1),
        SKEncodedOrigin.LeftTop => new SKMatrix(0, 1, 0, 1, 0, 0, 0, 0, 1),
        SKEncodedOrigin.RightTop => new SKMatrix(0, -1, height, 1, 0, 0, 0, 0, 1),
        SKEncodedOrigin.RightBottom => new SKMatrix(0, -1, height, -1, 0, width, 0, 0, 1),
        SKEncodedOrigin.LeftBottom => new SKMatrix(0, 1, 0, -1, 0, width, 0, 0, 1),
        _ => throw new ArgumentOutOfRangeException(nameof(origin), origin, "Unknown EXIF orientation"),
    };
}

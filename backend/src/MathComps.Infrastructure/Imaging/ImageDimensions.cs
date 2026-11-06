using SkiaSharp;
using Svg.Skia;

namespace MathComps.Infrastructure.Imaging;

/// <summary>
/// Reads an image file's intrinsic size in pixels. A PNG, JPEG or WebP is sized off its header by
/// <see cref="SKCodec"/>, and an SVG by the canvas it declares, through Svg.Skia's <see cref="SKSvg"/>.
/// </summary>
public static class ImageDimensions
{
    /// <summary>
    /// Reads an image file's width / height in whole pixels, picking the reader by extension.
    /// </summary>
    /// <param name="path">Absolute path to the image file.</param>
    /// <returns>The width and height in pixels.</returns>
    /// <exception cref="InvalidOperationException">
    /// Thrown for an unsupported extension, or a file the matched reader can't size.
    /// </exception>
    public static (int Width, int Height) Read(string path) =>
        Path.GetExtension(path).ToLowerInvariant() switch
        {
            ".svg" => ReadSvg(path),
            ".png" or ".jpg" or ".jpeg" or ".webp" => ReadRaster(path),
            var extension => throw new InvalidOperationException(
                $"Unsupported image format \"{extension}\" for: {Path.GetFileName(path)}"),
        };

    /// <summary>
    /// Sizes a raster file off its header via <see cref="SKCodec"/>. No pixels are decoded, so a large photo costs
    /// little to measure.
    /// </summary>
    /// <param name="path">Absolute path to the raster file.</param>
    /// <returns>The width and height in pixels.</returns>
    /// <exception cref="InvalidOperationException">Thrown when the file isn't a readable raster image.</exception>
    private static (int Width, int Height) ReadRaster(string path)
    {
        // A codec over the file's header, refusing a file that is no image it can read.
        using var codec = SKCodec.Create(path)
            ?? throw new InvalidOperationException(
                $"Could not read raster image dimensions for: {Path.GetFileName(path)}");

        // The width and height off the header info.
        return (codec.Info.Width, codec.Info.Height);
    }

    /// <summary>
    /// Sizes an SVG via Svg.Skia: its picture's cull rect is the canvas the document declares, with <c>pt</c>
    /// resolved to <c>px</c>, so an SVG with nothing drawn in it still has a size.
    /// </summary>
    /// <param name="path">Absolute path to the SVG file.</param>
    /// <returns>The width and height in whole pixels.</returns>
    /// <exception cref="InvalidOperationException">
    /// Thrown when the SVG can't be parsed or carries no usable size.
    /// </exception>
    private static (int Width, int Height) ReadSvg(string path)
    {
        // A fresh SVG loader.
        using var svg = new SKSvg();

        // Load the SVG, refusing it as unreadable when parsing throws.
        SKPicture? picture;
        try
        {
            picture = svg.Load(path);
        }
        catch (Exception exception)
        {
            throw new InvalidOperationException(
                $"Could not read SVG dimensions for: {Path.GetFileName(path)}", exception);
        }

        // The declared canvas, empty when the SVG is malformed or declares no size.
        var rect = picture?.CullRect ?? SKRect.Empty;

        // An empty canvas has no size to read.
        if (rect.Width <= 0 || rect.Height <= 0)
            throw new InvalidOperationException($"Could not read SVG dimensions for: {Path.GetFileName(path)}");

        // The declared canvas, rounded to whole pixels.
        return ((int)Math.Round(rect.Width), (int)Math.Round(rect.Height));
    }
}

using SkiaSharp;
using Svg.Skia;

namespace MathComps.Infrastructure.BulkImport;

/// <summary>
/// Reads any supported figure's intrinsic pixel dimensions, dispatching by file extension to the SkiaSharp family:
/// raster formats (PNG, JPEG, WebP) through <see cref="SKCodec"/>'s header-only identify, and SVG through Svg.Skia's
/// <see cref="SKSvg"/> (whose cull rect resolves the declared canvas, converting <c>pt</c> to <c>px</c> and working
/// even for a figure with no drawn content). An unsupported extension throwing here is also how the supported-format
/// whitelist is enforced, so there's no separate list to keep in step.
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
    /// Sizes a raster file off its header via <see cref="SKCodec"/> — no pixels are decoded, so a large photo still
    /// costs little to measure.
    /// </summary>
    /// <param name="path">Absolute path to the raster file.</param>
    /// <returns>The width and height in pixels.</returns>
    /// <exception cref="InvalidOperationException">Thrown when the file isn't a readable raster image.</exception>
    private static (int Width, int Height) ReadRaster(string path)
    {
        // SKCodec parses only the header and returns null (rather than throwing) for anything it can't decode, so a
        // corrupt or wrong-format file surfaces as our standard authoring error.
        using var codec = SKCodec.Create(path)
            ?? throw new InvalidOperationException($"Could not read raster image dimensions for: {Path.GetFileName(path)}");

        // The width and height off the header info.
        return (codec.Info.Width, codec.Info.Height);
    }

    /// <summary>
    /// Sizes an SVG via Svg.Skia: its picture's cull rect is the canvas the document declares, with <c>pt</c>
    /// resolved to <c>px</c>, so it sizes a figure with no drawn content too.
    /// </summary>
    /// <param name="path">Absolute path to the SVG file.</param>
    /// <returns>The width and height in whole pixels.</returns>
    /// <exception cref="InvalidOperationException">Thrown when the SVG can't be parsed or carries no usable size.</exception>
    private static (int Width, int Height) ReadSvg(string path)
    {
        // A fresh SVG loader.
        using var svg = new SKSvg();

        // A malformed SVG leaves the picture null (and a few parse faults throw) — fold either into our contract.
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

        // A null picture or a zero-sized canvas means no usable width/height — an authoring error, not a 0x0 figure.
        var rect = picture?.CullRect ?? SKRect.Empty;
        if (rect.Width <= 0 || rect.Height <= 0)
            throw new InvalidOperationException($"Could not read SVG dimensions for: {Path.GetFileName(path)}");

        // The cull rect is float; round to whole pixels.
        return ((int)Math.Round(rect.Width), (int)Math.Round(rect.Height));
    }
}

using SkiaSharp;

namespace MathComps.Infrastructure.Tests.TestInfrastructure;

/// <summary>
/// Pictures for tests that read them: the committed fixture files, and plain ones built in code.
/// </summary>
public static class TestPictures
{
    /// <summary>
    /// Resolves a fixture file under <c>Fixtures/Images</c> in the test output.
    /// </summary>
    /// <param name="relativePath">The fixture's path under <c>Fixtures/Images</c>.</param>
    /// <returns>The fixture's absolute path.</returns>
    public static string Fixture(string relativePath) =>
        Path.Combine(AppContext.BaseDirectory, "Fixtures", "Images", relativePath);

    /// <summary>
    /// Builds an image file of one colour.
    /// </summary>
    /// <param name="width">The picture's width in pixels.</param>
    /// <param name="height">The picture's height in pixels.</param>
    /// <param name="color">The colour every pixel takes.</param>
    /// <param name="format">The file's format.</param>
    /// <returns>The file's bytes.</returns>
    public static byte[] Plain(
        int width, int height, SKColor color, SKEncodedImageFormat format = SKEncodedImageFormat.Png)
    {
        // A bitmap of the size, filled with the colour.
        using var bitmap = new SKBitmap(width, height);
        bitmap.Erase(color);

        // Encode the bitmap in the format.
        using var image = SKImage.FromBitmap(bitmap);
        using var encoded = image.Encode(format, 100);

        // Hand back the file's bytes.
        return encoded.ToArray();
    }

    /// <summary>
    /// A one-pixel GIF, a format the encoder can't write. A new copy on every read, so no test changes another's.
    /// </summary>
    public static byte[] OnePixelGif =>
    [
        0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00, 0xFF, 0xFF, 0xFF, 0x00, 0x00,
        0x00, 0x21, 0xF9, 0x04, 0x01, 0x00, 0x00, 0x00, 0x00, 0x2C, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
        0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3B,
    ];
}

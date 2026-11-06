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
}

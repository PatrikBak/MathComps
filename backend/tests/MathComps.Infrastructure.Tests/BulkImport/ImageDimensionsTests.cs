using MathComps.Infrastructure.BulkImport;

namespace MathComps.Infrastructure.Tests.BulkImport;

/// <summary>
/// Unit tests for <see cref="ImageDimensions.Read"/> — the one reader for every supported figure format: raster
/// (PNG / JPEG / WebP) via SkiaSharp's <c>SKCodec</c>, SVG via Svg.Skia. They run against real fixtures (committed
/// under <c>Fixtures/Images</c>, non-square so a swapped width/height is caught, covering all three WebP sub-formats
/// and both a px and a pt SVG) and pin the failure contract: an unsupported extension or an unreadable file throws.
/// </summary>
public class ImageDimensionsTests
{
    /// <summary>
    /// A PNG read back as whole pixels.
    /// </summary>
    [Fact]
    public void Reads_png() =>
        Assert.Equal((4, 2), ImageDimensions.Read(Fixture("fig.png")));

    /// <summary>
    /// A JPEG read back as whole pixels.
    /// </summary>
    [Fact]
    public void Reads_jpeg() =>
        Assert.Equal((7, 3), ImageDimensions.Read(Fixture("fig.jpg")));

    /// <summary>
    /// A lossy (VP8) WebP read back as whole pixels.
    /// </summary>
    [Fact]
    public void Reads_lossy_webp() =>
        Assert.Equal((4, 2), ImageDimensions.Read(Fixture("fig-lossy.webp")));

    /// <summary>
    /// A lossless (VP8L) WebP read back as whole pixels.
    /// </summary>
    [Fact]
    public void Reads_lossless_webp() =>
        Assert.Equal((4, 2), ImageDimensions.Read(Fixture("fig-lossless.webp")));

    /// <summary>
    /// An extended (VP8X) WebP read back as whole pixels.
    /// </summary>
    [Fact]
    public void Reads_extended_webp() =>
        Assert.Equal((4, 2), ImageDimensions.Read(Fixture("fig-extended.webp")));

    /// <summary>
    /// An SVG declaring px dimensions read back as whole pixels — even with no drawn content.
    /// </summary>
    [Fact]
    public void Reads_svg_in_pixels() =>
        Assert.Equal((6, 9), ImageDimensions.Read(Fixture("fig.svg")));

    /// <summary>
    /// An SVG declaring pt dimensions is resolved to pixels (72pt → 96px, 10pt → 13px).
    /// </summary>
    [Fact]
    public void Reads_svg_converting_points_to_pixels() =>
        Assert.Equal((96, 13), ImageDimensions.Read(Fixture("fig-pt.svg")));

    /// <summary>
    /// An unsupported extension is a hard error — this is how the format whitelist is enforced — and it throws on the
    /// extension alone, before any read, so the file needn't even exist.
    /// </summary>
    [Fact]
    public void Throws_on_an_unsupported_extension() =>
        Assert.Throws<InvalidOperationException>(() => ImageDimensions.Read(Fixture("fig.gif")));

    /// <summary>
    /// A raster file whose bytes are no known image is a hard error, not a silent zero.
    /// </summary>
    [Fact]
    public void Throws_on_a_corrupt_raster() =>
        AssertThrowsOnGarbage(".png");

    /// <summary>
    /// An SVG that doesn't parse is a hard error rather than a sizeless figure.
    /// </summary>
    [Fact]
    public void Throws_on_a_corrupt_svg() =>
        AssertThrowsOnGarbage(".svg");

    /// <summary>
    /// Writes garbage bytes to a temp file with the given extension and asserts <see cref="ImageDimensions.Read"/>
    /// rejects it.
    /// </summary>
    /// <param name="extension">The file extension (with dot) to give the garbage file.</param>
    private static void AssertThrowsOnGarbage(string extension)
    {
        // Garbage bytes that neither SKCodec nor Svg.Skia can make sense of.
        var path = Path.Combine(Path.GetTempPath(), $"corrupt-{Guid.NewGuid():N}{extension}");
        File.WriteAllBytes(path, [0x00, 0x01, 0x02, 0x03]);
        try
        {
            Assert.Throws<InvalidOperationException>(() => ImageDimensions.Read(path));
        }
        finally
        {
            File.Delete(path);
        }
    }

    /// <summary>
    /// Resolves a committed image fixture by file name.
    /// </summary>
    /// <param name="name">The fixture file name under <c>Fixtures/Images</c>.</param>
    /// <returns>The absolute path to the fixture in the test output directory.</returns>
    private static string Fixture(string name) =>
        Path.Combine(AppContext.BaseDirectory, "Fixtures", "Images", name);
}

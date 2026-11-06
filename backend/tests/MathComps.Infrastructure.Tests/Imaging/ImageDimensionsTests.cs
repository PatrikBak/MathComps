using MathComps.Infrastructure.Imaging;
using MathComps.Infrastructure.Tests.TestInfrastructure;

namespace MathComps.Infrastructure.Tests.Imaging;

/// <summary>
/// Unit tests for <see cref="ImageDimensions.Read"/> over real fixtures in <c>Fixtures/Images</c>. The fixtures are
/// non-square, so a swapped width and height fails, and they cover each WebP sub-format and SVGs sized in px and in
/// pt. An unsupported extension or an unreadable file throws.
/// </summary>
public class ImageDimensionsTests
{
    /// <summary>
    /// A PNG read back as whole pixels.
    /// </summary>
    [Fact]
    public void Reads_png() =>
        Assert.Equal((4, 2), ImageDimensions.Read(TestPictures.Fixture("fig.png")));

    /// <summary>
    /// A JPEG read back as whole pixels.
    /// </summary>
    [Fact]
    public void Reads_jpeg() =>
        Assert.Equal((7, 3), ImageDimensions.Read(TestPictures.Fixture("fig.jpg")));

    /// <summary>
    /// A lossy (VP8) WebP read back as whole pixels.
    /// </summary>
    [Fact]
    public void Reads_lossy_webp() =>
        Assert.Equal((4, 2), ImageDimensions.Read(TestPictures.Fixture("fig-lossy.webp")));

    /// <summary>
    /// A lossless (VP8L) WebP read back as whole pixels.
    /// </summary>
    [Fact]
    public void Reads_lossless_webp() =>
        Assert.Equal((4, 2), ImageDimensions.Read(TestPictures.Fixture("fig-lossless.webp")));

    /// <summary>
    /// An extended (VP8X) WebP read back as whole pixels.
    /// </summary>
    [Fact]
    public void Reads_extended_webp() =>
        Assert.Equal((4, 2), ImageDimensions.Read(TestPictures.Fixture("fig-extended.webp")));

    /// <summary>
    /// An SVG declaring px dimensions read back as whole pixels, though nothing is drawn in it.
    /// </summary>
    [Fact]
    public void Reads_svg_in_pixels() =>
        Assert.Equal((6, 9), ImageDimensions.Read(TestPictures.Fixture("fig.svg")));

    /// <summary>
    /// An SVG declaring pt dimensions is resolved to pixels (72pt → 96px, 10pt → 13px).
    /// </summary>
    [Fact]
    public void Reads_svg_converting_points_to_pixels() =>
        Assert.Equal((96, 13), ImageDimensions.Read(TestPictures.Fixture("fig-pt.svg")));

    /// <summary>
    /// An unsupported extension throws on the extension alone, before any read, so the file needn't even exist.
    /// </summary>
    [Fact]
    public void Throws_on_an_unsupported_extension() =>
        Assert.Throws<InvalidOperationException>(() => ImageDimensions.Read("figure.gif"));

    /// <summary>
    /// A raster file whose bytes are no known image throws.
    /// </summary>
    [Fact]
    public void Throws_on_a_corrupt_raster() =>
        Assert.Throws<InvalidOperationException>(() => ImageDimensions.Read(TestPictures.Fixture("corrupt.png")));

    /// <summary>
    /// An SVG that doesn't parse throws.
    /// </summary>
    [Fact]
    public void Throws_on_a_corrupt_svg() =>
        Assert.Throws<InvalidOperationException>(() => ImageDimensions.Read(TestPictures.Fixture("corrupt.svg")));
}

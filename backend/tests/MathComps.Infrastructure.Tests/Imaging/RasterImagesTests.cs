using System.Text;
using MathComps.Infrastructure.Imaging;
using MathComps.Infrastructure.Tests.TestInfrastructure;
using SkiaSharp;

namespace MathComps.Infrastructure.Tests.Imaging;

/// <summary>
/// Tests <see cref="RasterImages"/> against real files: the upright bitmap an image decodes to under each EXIF
/// orientation, its size, its background, the scale a big image decodes at, the files it refuses, and the rectangle
/// a JPEG is cut from. A wrong turn, size or background fails silently, since a sideways, mirrored or blackened image
/// still decodes.
/// </summary>
public class RasterImagesTests
{
    /// <summary>
    /// A pixel cap no test image comes near.
    /// </summary>
    private const long NoCap = long.MaxValue;

    /// <summary>
    /// The colours a test names a pixel by: the orientation fixtures' four quadrants, keyed by the letter each test
    /// names them with, and the white of a blank background.
    /// </summary>
    private static readonly Dictionary<char, SKColor> _namedColors = new()
    {
        ['R'] = new SKColor(255, 0, 0),
        ['G'] = new SKColor(0, 200, 0),
        ['B'] = new SKColor(0, 0, 255),
        ['Y'] = new SKColor(255, 220, 0),
        ['W'] = SKColors.White,
    };

    /// <summary>
    /// Each EXIF orientation is turned upright, whatever mix of mirror and quarter turn it stands for, and shrunk in
    /// the same pass. Every fixture stores the same 80 by 40 picture, red top-left, green top-right, blue bottom-left
    /// and yellow bottom-right, and the expected quadrants are what Pillow's own <c>exif_transpose</c> shows for that
    /// orientation. A wrong transform for an orientation mirrors or flips the image, and turning and shrinking in the
    /// wrong order draws it off its own canvas.
    /// </summary>
    /// <param name="orientation">The EXIF orientation the fixture is stored with.</param>
    /// <param name="width">The upright bitmap's expected width at half size.</param>
    /// <param name="height">The upright bitmap's expected height at half size.</param>
    /// <param name="quadrants">The expected colours of the upright quadrants: top-left, top-right, bottom-left,
    /// bottom-right.</param>
    [Theory]
    [InlineData(1, 40, 20, "RGBY")]
    [InlineData(2, 40, 20, "GRYB")]
    [InlineData(3, 40, 20, "YBGR")]
    [InlineData(4, 40, 20, "BYRG")]
    [InlineData(5, 20, 40, "RBGY")]
    [InlineData(6, 20, 40, "BRYG")]
    [InlineData(7, 20, 40, "YGBR")]
    [InlineData(8, 20, 40, "GYRB")]
    public void Each_orientation_is_turned_upright(int orientation, int width, int height, string quadrants)
    {
        // The four-colour picture, stored under the orientation.
        var image = File.ReadAllBytes(TestPictures.Fixture(Path.Combine("Exif", $"orientation-{orientation}.jpg")));

        // Decode the image with a long edge half its own.
        using var upright = RasterImages.DecodeUpright(image, longEdge: 40, maxPixels: NoCap);

        // The result has the upright size, halved.
        Assert.NotNull(upright);
        Assert.Equal((width, height), (upright.Width, upright.Height));

        // Each quadrant's colour landed where the orientation puts it.
        Assert.Equal(quadrants, Quadrants(upright));
    }

    /// <summary>
    /// An image already within the long edge keeps its size: a small image is never enlarged.
    /// </summary>
    [Fact]
    public void An_image_within_the_long_edge_is_never_enlarged()
    {
        // An image a quarter of the long edge wide.
        var image = TestPictures.Plain(100, 50, SKColors.Gray);

        // Decode the image with a long edge of 400.
        using var upright = RasterImages.DecodeUpright(image, longEdge: 400, maxPixels: NoCap);

        // The result keeps the image's size.
        Assert.NotNull(upright);
        Assert.Equal((100, 50), (upright.Width, upright.Height));
    }

    /// <summary>
    /// A JPEG holding more pixels than the cap is still read: it decodes at an eighth of its stored size, which still
    /// covers the long edge and fits the cap. Decoded whole, the same JPEG would be refused.
    /// </summary>
    [Fact]
    public void A_jpeg_past_the_cap_is_read_at_a_smaller_scale()
    {
        // A JPEG of 1,280,000 pixels, eight times the long edge across.
        var image = TestPictures.Plain(1600, 800, SKColors.Gray, SKEncodedImageFormat.Jpeg);

        // Decode the JPEG under a cap that holds its eighth, 200 by 100, and nothing bigger.
        using var upright = RasterImages.DecodeUpright(image, longEdge: 200, maxPixels: 20_000);

        // The result came out at the long edge.
        Assert.NotNull(upright);
        Assert.Equal((200, 100), (upright.Width, upright.Height));
    }

    /// <summary>
    /// A JPEG is decoded at the smallest eighth that still covers the long edge, never at a nearer one short of it.
    /// A decode short of it gives a result smaller than asked for, and softer, with nothing failing.
    /// </summary>
    [Fact]
    public void A_jpeg_is_never_decoded_short_of_the_long_edge()
    {
        // A JPEG 1600 wide, whose nearest eighth to a long edge of 640 is three eighths, 600 across.
        var image = TestPictures.Plain(1600, 800, SKColors.Gray, SKEncodedImageFormat.Jpeg);

        // Decode the JPEG with a long edge of 640.
        using var upright = RasterImages.DecodeUpright(image, longEdge: 640, maxPixels: NoCap);

        // The result has the whole long edge, shrunk from the four eighths decoded.
        Assert.NotNull(upright);
        Assert.Equal((640, 320), (upright.Width, upright.Height));
    }

    /// <summary>
    /// A PNG, which can't be decoded smaller, is read when it holds exactly the cap and refused when it holds a pixel
    /// more.
    /// </summary>
    /// <param name="maxPixels">The most pixels the decode may hold.</param>
    /// <param name="read">Whether the PNG is read.</param>
    [Theory]
    [InlineData(10_000, true)]
    [InlineData(9_999, false)]
    public void A_png_past_the_cap_is_refused(long maxPixels, bool read)
    {
        // A PNG of ten thousand pixels.
        var image = TestPictures.Plain(100, 100, SKColors.Gray);

        // Decode the PNG under the cap, with a long edge it already fits.
        using var upright = RasterImages.DecodeUpright(image, longEdge: 400, maxPixels);

        // A result came out only when the PNG is within the cap.
        Assert.Equal(read, upright is not null);
    }

    /// <summary>
    /// A transparent background comes out white. Left transparent, it turns black once encoded as a JPEG, hiding
    /// anything dark drawn on it.
    /// </summary>
    [Fact]
    public void A_transparent_background_comes_out_white()
    {
        // An image with nothing on it but transparency.
        var image = TestPictures.Plain(40, 40, SKColors.Transparent);

        // Decode the image.
        using var upright = RasterImages.DecodeUpright(image, longEdge: 400, maxPixels: NoCap);

        // The result is white.
        Assert.NotNull(upright);
        Assert.Equal(SKColors.White, upright.GetPixel(20, 20));
    }

    /// <summary>
    /// A WebP image is read, as JPEG and PNG ones are.
    /// </summary>
    [Fact]
    public void A_webp_image_is_read()
    {
        // A WebP image.
        var image = File.ReadAllBytes(TestPictures.Fixture("fig-lossy.webp"));

        // Decode the image.
        using var upright = RasterImages.DecodeUpright(image, longEdge: 400, maxPixels: NoCap);

        // A result came out.
        Assert.NotNull(upright);
    }

    /// <summary>
    /// Bytes that are no image, empty bytes among them, are refused rather than thrown on.
    /// </summary>
    /// <param name="content">The bytes, written as text.</param>
    [Theory]
    [InlineData("")]
    [InlineData("not an image")]
    public void Bytes_that_are_no_image_are_refused(string content)
    {
        // Decode the bytes.
        using var upright = RasterImages.DecodeUpright(
            Encoding.UTF8.GetBytes(content), longEdge: 400, maxPixels: NoCap);

        // Nothing came out.
        Assert.Null(upright);
    }

    /// <summary>
    /// A format the decoder can read but <see cref="RasterImages.DecodeUpright"/> doesn't take, a GIF, is refused like
    /// bytes that are no image.
    /// </summary>
    [Fact]
    public void A_gif_is_refused()
    {
        // A one-pixel GIF.
        byte[] gif =
        [
            0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00, 0xFF, 0xFF, 0xFF, 0x00, 0x00,
            0x00, 0x21, 0xF9, 0x04, 0x01, 0x00, 0x00, 0x00, 0x00, 0x2C, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
            0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3B,
        ];

        // Decode the GIF.
        using var upright = RasterImages.DecodeUpright(gif, longEdge: 400, maxPixels: NoCap);

        // Nothing came out.
        Assert.Null(upright);
    }

    /// <summary>
    /// An image cut short, like a file copied or uploaded only in part, is refused rather than read as a bitmap whose
    /// missing rows were filled in.
    /// </summary>
    [Fact]
    public void An_image_cut_short_is_refused()
    {
        // A random source on a fixed seed, so every run paints the same picture.
        var random = new Random(7);

        // A picture of a random colour at every pixel, so the JPEG's pixel data outweighs its header many times over.
        using var bitmap = new SKBitmap(300, 300);
        bitmap.Pixels =
        [
            .. Enumerable.Range(0, 300 * 300).Select(_ =>
                new SKColor((byte)random.Next(256), (byte)random.Next(256), (byte)random.Next(256))),
        ];

        // The picture as a JPEG.
        var whole = RasterImages.EncodeJpeg(bitmap, bitmap.Info.Rect, quality: 90);

        // The JPEG with its header whole and its last third gone.
        var image = whole[..(whole.Length * 2 / 3)];

        // Decode the cut-short JPEG.
        using var upright = RasterImages.DecodeUpright(image, longEdge: 400, maxPixels: NoCap);

        // Nothing came out.
        Assert.Null(upright);
    }

    /// <summary>
    /// A JPEG is cut from exactly the rectangle asked for: its size, and the part of the bitmap it shows.
    /// </summary>
    [Fact]
    public void A_jpeg_is_cut_from_exactly_the_area()
    {
        // A bitmap red on its left half and blue on its right.
        using var bitmap = new SKBitmap(100, 50);
        bitmap.Erase(SKColors.Red);
        bitmap.Erase(SKColors.Blue, new SKRectI(50, 0, 100, 50));

        // Cut the right half, a strip short of the bottom.
        var jpeg = RasterImages.EncodeJpeg(bitmap, new SKRectI(50, 0, 100, 40), quality: 90);

        // Read the JPEG back.
        using var cut = SKBitmap.Decode(jpeg);

        // The cut is the rectangle's size.
        Assert.Equal((50, 40), (cut.Width, cut.Height));

        // The cut shows the blue half and none of the red.
        Assert.Equal('B', Nearest(cut.GetPixel(2, 2)));
        Assert.Equal('B', Nearest(cut.GetPixel(47, 37)));
    }

    /// <summary>
    /// Reads the colour at the centre of each quadrant of a bitmap, as the letters of the named colours they are
    /// nearest to.
    /// </summary>
    /// <param name="bitmap">The bitmap to read.</param>
    /// <returns>The quadrants' letters: top-left, top-right, bottom-left, bottom-right.</returns>
    private static string Quadrants(SKBitmap bitmap)
    {
        // The centres of the left and right halves, across.
        var (left, right) = (bitmap.Width / 4, bitmap.Width * 3 / 4);

        // The centres of the top and bottom halves, down.
        var (top, bottom) = (bitmap.Height / 4, bitmap.Height * 3 / 4);

        // Name each quadrant's colour, in reading order.
        return string.Concat(
            Nearest(bitmap.GetPixel(left, top)),
            Nearest(bitmap.GetPixel(right, top)),
            Nearest(bitmap.GetPixel(left, bottom)),
            Nearest(bitmap.GetPixel(right, bottom)));
    }

    /// <summary>
    /// Names the colour nearest to a pixel, which JPEG never reproduces exactly.
    /// </summary>
    /// <param name="pixel">The pixel to name.</param>
    /// <returns>The nearest named colour's letter.</returns>
    private static char Nearest(SKColor pixel) =>
        _namedColors.MinBy(entry => Distance(entry.Value, pixel)).Key;

    /// <summary>
    /// The squared distance between two colours, across red, green and blue.
    /// </summary>
    /// <param name="first">One colour.</param>
    /// <param name="second">The other colour.</param>
    /// <returns>The sum of the squared differences in red, green and blue.</returns>
    private static int Distance(SKColor first, SKColor second) =>
        ((first.Red - second.Red) * (first.Red - second.Red))
        + ((first.Green - second.Green) * (first.Green - second.Green))
        + ((first.Blue - second.Blue) * (first.Blue - second.Blue));
}

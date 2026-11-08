using MathComps.Infrastructure.Options;
using MathComps.Infrastructure.Services.Photos;
using MathComps.Infrastructure.Tests.TestInfrastructure;
using MathComps.Shared.Io;
using Microsoft.Extensions.Logging.Abstractions;
using SkiaSharp;
using MsOptions = Microsoft.Extensions.Options.Options;

namespace MathComps.Infrastructure.Tests.Photos;

/// <summary>
/// Tests what <see cref="PhotoReader"/> does around its one model call: the bytes it refuses before calling, the page
/// it shows the model, the drawings it cuts out of that page from the model's boxes, and the markers it takes out of
/// the text. The page and the drawings fail silently when wrong: a model shown the wrong image still gives a fluent
/// reading, and a misread box still cuts a picture. A stand-in endpoint answers the real caller with the reply JSON
/// the model would send.
/// </summary>
public class PhotoReaderTests
{
    /// <summary>
    /// The reading prompt the app ships, as a path under the app's folder.
    /// </summary>
    private const string ReadingPrompt = "Prompts/read-photo.txt";

    /// <summary>
    /// The model is shown the shrunk page the reading hands back, as the image after the prompt, with no system
    /// message. The crops are cut from that same page, so each box lands where the model saw its drawing.
    /// </summary>
    [Fact]
    public async Task The_model_reads_the_page_handed_back()
    {
        // A photo 600 wide, half again the long edge of 400 it is read with.
        var photo = TestPictures.Plain(600, 300, SKColors.Gray);

        // A model that finds no drawing.
        using var endpoint = FakeChatEndpoint.Answering(/*lang=json,strict*/ """{"text": "text", "figures": []}""");

        // Read the photo with a long edge of 400.
        var reading = await ReaderOver(endpoint, longEdge: 400).ReadAsync(photo);

        // The one call sent one message, the user's.
        var message = Assert.Single(Assert.Single(endpoint.Requests).GetProperty("messages").EnumerateArray());

        // Its content parts, the text and then the image.
        var parts = message.GetProperty("content").EnumerateArray().ToList();

        // The shipped reading prompt.
        var prompt = await FileUtilities.ReadAppFileAsync(ReadingPrompt);

        // The text part is that prompt.
        Assert.Equal(prompt, parts[0].GetProperty("text").GetString());

        // The image part is the page handed back.
        Assert.Equal(
            $"data:image/jpeg;base64,{Convert.ToBase64String(reading.Value.Page)}",
            parts[1].GetProperty("image_url").GetProperty("url").GetString());

        // The page handed back is shrunk to the long edge.
        using var page = SKBitmap.Decode(reading.Value.Page);
        Assert.Equal((400, 200), (page.Width, page.Height));
    }

    /// <summary>
    /// Each drawing is cut from its box read as <c>[ymin, xmin, ymax, xmax]</c> in thousandths of the page, widened by
    /// the margin on every side, and a box touching the page's edge is clamped to it. Reading the box in the wrong
    /// order, or forgetting to scale, still cuts a picture, of the wrong part of the page.
    /// </summary>
    [Fact]
    public async Task Each_drawing_is_cut_from_its_box_with_the_margin()
    {
        // A page 1000 pixels wide and 500 tall, so a box unit is one pixel across and half a pixel down.
        var photo = TestPictures.Plain(1000, 500, SKColors.Gray);

        // One drawing inside the page, and one in its top-right corner.
        using var endpoint = FakeChatEndpoint.Answering(/*lang=json,strict*/ """
            {
              "text": "[Figure 1] [Figure 2]",
              "figures": [
                { "label": "Figure 1", "box_2d": [200, 300, 400, 600] },
                { "label": "Figure 2", "box_2d": [0, 950, 100, 1000] }
              ]
            }
            """);

        // Read the photo with a margin of 40 units.
        var reading = await ReaderOver(endpoint, cropMargin: 40).ReadAsync(photo);

        // Both drawings came out, in the order the reading lists them.
        Assert.Equal(["Figure 1", "Figure 2"], reading.Value.Crops.Select(crop => crop.Label));

        // The first is 380 by 140 pixels, its box widened by 40 units a side.
        using var inside = SKBitmap.Decode(reading.Value.Crops[0].Image);
        Assert.Equal((380, 140), (inside.Width, inside.Height));

        // The second's margin stops at the page's top and right edges.
        using var atEdge = SKBitmap.Decode(reading.Value.Crops[1].Image);
        Assert.Equal((90, 70), (atEdge.Width, atEdge.Height));
    }

    /// <summary>
    /// A box that marks out no part of the page is dropped, and the drawings around it are still cut: one bad box
    /// costs that drawing, never the whole reading.
    /// </summary>
    [Fact]
    public async Task A_box_marking_out_nothing_is_dropped()
    {
        // A plain page.
        var photo = TestPictures.Plain(1000, 500, SKColors.Gray);

        // A box of three numbers, one with no height, one with no width, one wholly below the page, and one good box.
        using var endpoint = FakeChatEndpoint.Answering(/*lang=json,strict*/ """
            {
              "text": "text",
              "figures": [
                { "label": "Figure 1", "box_2d": [100, 100, 300] },
                { "label": "Figure 2", "box_2d": [500, 200, 500, 400] },
                { "label": "Figure 3", "box_2d": [200, 500, 400, 500] },
                { "label": "Figure 4", "box_2d": [1100, 0, 1300, 500] },
                { "label": "Figure 5", "box_2d": [100, 100, 300, 300] }
              ]
            }
            """);

        // Read the photo.
        var reading = await ReaderOver(endpoint).ReadAsync(photo);

        // Only the good box was cut.
        Assert.Equal("Figure 5", Assert.Single(reading.Value.Crops).Label);
    }

    /// <summary>
    /// Every drawing's marker leaves the text, a dropped drawing's too, along with the spaces and blank lines around
    /// it, while brackets that mark no drawing stay. A marker left in would show the student a <c>[Figure 1]</c> that
    /// points at nothing.
    /// </summary>
    [Fact]
    public async Task The_drawings_markers_leave_the_text()
    {
        // A plain page.
        var photo = TestPictures.Plain(1000, 500, SKColors.Gray);

        // A marker on a line of its own, one inside a line, and one opening a line for a drawing whose box marks out
        // nothing, around a bit the model couldn't read.
        using var endpoint = FakeChatEndpoint.Answering(/*lang=json,strict*/ """
            {
              "text": "Let $ABC$ be a triangle.\n\n[Figure 1]\n\nAs [Figure 2] shows, $x = [unreadable]$.\n[Figure 3] Done.",
              "figures": [
                { "label": "Figure 1", "box_2d": [100, 100, 300, 300] },
                { "label": "Figure 2", "box_2d": [500, 100, 700, 300] },
                { "label": "Figure 3", "box_2d": [100, 100, 300] }
              ]
            }
            """);

        // Read the photo.
        var reading = await ReaderOver(endpoint).ReadAsync(photo);

        // The text with no marker in it, and its unreadable bit kept.
        Assert.Equal("Let $ABC$ be a triangle.\n\nAs shows, $x = [unreadable]$.\nDone.", reading.Value.Text);
    }

    /// <summary>
    /// Bytes that are no image are refused before the model is called, so a bad upload costs nothing.
    /// </summary>
    [Fact]
    public async Task Bytes_that_are_no_image_are_refused_before_any_call()
    {
        // A model that would answer if asked.
        using var endpoint = FakeChatEndpoint.Answering(/*lang=json,strict*/ """{"text": "text", "figures": []}""");

        // Read a few bytes of text.
        var read = ReaderOver(endpoint).ReadAsync("not a photo"u8.ToArray());

        // The photo is refused as unreadable.
        await Assert.ThrowsAsync<UnreadablePhotoException>(() => read);

        // The model was never asked.
        Assert.Empty(endpoint.Requests);
    }

    /// <summary>
    /// Builds the real reader calling the stand-in endpoint, with the reading prompt the app ships.
    /// </summary>
    /// <param name="endpoint">The stand-in for the model's endpoint.</param>
    /// <param name="longEdge"><inheritdoc cref="PhotoReaderSettings.LongEdge" path="/summary"/></param>
    /// <param name="cropMargin"><inheritdoc cref="PhotoReaderSettings.CropMargin" path="/summary"/></param>
    /// <returns>The reader.</returns>
    private static PhotoReader ReaderOver(
        FakeChatEndpoint endpoint, int longEdge = 2000, int cropMargin = 40)
    {
        // Settings for the shipped reading prompt, with the knobs a test turns.
        var settings = new PhotoReaderSettings
        {
            Reading = new ChatStepSettings { Prompt = ReadingPrompt, Model = "test-model" },
            LongEdge = longEdge,
            JpegQuality = 90,
            CropMargin = cropMargin,
            MaxDecodedMegapixels = 100,
        };

        // The reader calling the stand-in.
        return new PhotoReader(endpoint.Caller, NullLogger<PhotoReader>.Instance, MsOptions.Create(settings));
    }
}

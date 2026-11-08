using System.Net.Mime;
using System.Text.RegularExpressions;
using MathComps.Infrastructure.Imaging;
using MathComps.Infrastructure.Options;
using MathComps.Infrastructure.Services.Ai;
using MathComps.Shared.Extensions;
using MathComps.Shared.Io;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using SkiaSharp;

namespace MathComps.Infrastructure.Services.Photos;

/// <summary>
/// Implements <see cref="IPhotoReader"/> with one schema-bound model call per page. The page is turned upright and
/// shrunk before the model sees it, and the reading prompt rides as the user message's text with the page after it.
/// The model answers with the text and a <c>box_2d</c> per drawing, and each drawing is cut out of the page in code,
/// widened by the configured margin and clamped to the page. The model marks where each drawing sits in the text, and
/// the reader takes those markers out: the drawings travel as crops apart from the text, where a marker would point at
/// nothing.
/// </summary>
/// <param name="chatCaller">The caller the reading call runs through.</param>
/// <param name="logger">The logger.</param>
/// <param name="photoReaderSettings">The reading call, how the page is prepared, and how its drawings are cut.</param>
public class PhotoReader(
    ILlmChatCaller chatCaller,
    ILogger<PhotoReader> logger,
    IOptions<PhotoReaderSettings> photoReaderSettings)
    : IPhotoReader
{
    /// <summary>
    /// The name the reading call is logged under.
    /// </summary>
    private const string StepName = "PhotoReading";

    /// <summary>
    /// The reading settings.
    /// </summary>
    private readonly PhotoReaderSettings _settings = photoReaderSettings.Value;

    /// <summary>
    /// Matches a run of two or more blank lines, which a paragraph break needs only one of.
    /// </summary>
    private static readonly Regex _blankLinesPattern = new(@"\n([ \t]*\n){2,}", RegexOptions.Compiled);

    /// <inheritdoc/>
    public async Task<ChatCallResult<PhotoReading>> ReadAsync(
        ReadOnlyMemory<byte> photo, CancellationToken cancellationToken = default)
    {
        // The page upright and shrunk, or a refusal when the photo can't be decoded within the decoded-pixel cap.
        using var page = RasterImages.DecodeUpright(photo.Span, _settings.LongEdge, _settings.MaxDecodedPixels)
            ?? throw new UnreadablePhotoException();

        // The page as the JPEG the model reads.
        var pageJpeg = RasterImages.EncodeJpeg(page, page.Info.Rect, _settings.JpegQuality);

        // The reading instructions.
        var prompt = await FileUtilities.ReadAppFileAsync(_settings.Reading.Prompt, cancellationToken);

        // One call carrying the instructions as the user message, with the page shown after them.
        var request = ChatCallRequest.For(
            StepName,
            _settings.Reading,
            systemPrompt: null,
            new ChatUserMessage([new ChatText(prompt), new ChatImage(pageJpeg, MediaTypeNames.Image.Jpeg)]));

        // Read the page. The boxes need the schema, so the text rides in the same structured reply.
        var reply = await chatCaller.CompleteAsync<PhotoReadingReply>(request, cancellationToken);

        // Cut out every drawing whose box marks out part of the page.
        var crops = reply.Value.Figures.Select(figure => Cut(page, figure)).OfType<PhotoCrop>().ToList();

        // The text without the drawings' markers, a dropped drawing's included.
        var text = WithoutMarkers(reply.Value.Text, reply.Value.Figures.Select(figure => figure.Label));

        // Hand back the reading with what answered and what it billed.
        return new ChatCallResult<PhotoReading>(
            new PhotoReading(text, pageJpeg, crops), reply.ServedModel, reply.Usage);
    }

    /// <summary>
    /// Takes each drawing's marker, its label in brackets, out of the page's text, along with the spaces and blank
    /// lines it would leave behind.
    /// </summary>
    /// <param name="text">The page's text as the model wrote it.</param>
    /// <param name="labels">The labels of the drawings the model found.</param>
    /// <returns>The text with no drawing's marker in it.</returns>
    private static string WithoutMarkers(string text, IEnumerable<string> labels)
    {
        // Each marker out: one opening a line with the spaces around it, one inside a line with the space before it.
        foreach (var marker in labels.Select(label => Regex.Escape($"[{label}]")))
            text = Regex.Replace(text, $@"^[ \t]*{marker}[ \t]*|[ \t]*{marker}", "", RegexOptions.Multiline);

        // Every run of blank lines, a marker's emptied line among them, down to one paragraph break, and none at
        // either end.
        return _blankLinesPattern.Replace(text, "\n\n").Trim();
    }

    /// <summary>
    /// Cuts one drawing out of the page, or reports it and cuts nothing when its box marks out no part of the page.
    /// </summary>
    /// <param name="page">The upright page the model read.</param>
    /// <param name="figure">The drawing the model found.</param>
    /// <returns>The drawing cut out, or null when its box marks out nothing.</returns>
    private PhotoCrop? Cut(SKBitmap page, PhotoReadingFigure figure)
    {
        // Where the drawing sits on the page in pixels, margin included.
        var area = CropArea(figure.Box, page.Width, page.Height, _settings.CropMargin);

        // A box that marks out nothing loses the drawing, and the reading goes on without it.
        if (area is null)
        {
            // Say which drawing was lost and what the model gave for it.
            logger.LogWarning(
                "Photo reading dropped {Label}, whose box [{Box}] marks out no part of the page",
                figure.Label, figure.Box.ToJoinedString());

            // Nothing to cut.
            return null;
        }

        // Cut the drawing out.
        return new PhotoCrop(figure.Label, RasterImages.EncodeJpeg(page, area.Value, _settings.JpegQuality));
    }

    /// <summary>
    /// Turns a model box into the rectangle of the page to cut: <c>[ymin, xmin, ymax, xmax]</c> in thousandths of the
    /// page, widened by the margin on every side, clamped to the page and scaled to its pixels.
    /// </summary>
    /// <param name="box">The box as the model gave it.</param>
    /// <param name="width">The page's width in pixels.</param>
    /// <param name="height">The page's height in pixels.</param>
    /// <param name="margin">How far to widen the box on every side, in thousandths of the page.</param>
    /// <returns>The rectangle to cut, or null when the box isn't four numbers, encloses nothing, lies off the page, or
    /// is too thin to cover a pixel.</returns>
    private static SKRectI? CropArea(IReadOnlyList<int> box, int width, int height, int margin)
    {
        // A box is four numbers, top before bottom and left before right; anything else marks out nothing.
        if (box is not [var top, var left, var bottom, var right] || top >= bottom || left >= right)
            return null;

        // A whole side of the page, in the thousandths the box is given in.
        const int pageSide = 1000;

        // The box widened by the margin and clamped to the page, in thousandths of it.
        var clampedTop = Math.Clamp(top - margin, 0, pageSide);
        var clampedLeft = Math.Clamp(left - margin, 0, pageSide);
        var clampedBottom = Math.Clamp(bottom + margin, 0, pageSide);
        var clampedRight = Math.Clamp(right + margin, 0, pageSide);

        // The same rectangle in the page's pixels.
        var area = new SKRectI(
            clampedLeft * width / pageSide,
            clampedTop * height / pageSide,
            clampedRight * width / pageSide,
            clampedBottom * height / pageSide);

        // The rectangle, or nothing when it keeps no pixels: a box wholly off the page clamps to an edge, and a sliver
        // rounds away.
        return area is { Width: > 0, Height: > 0 } ? area : null;
    }
}

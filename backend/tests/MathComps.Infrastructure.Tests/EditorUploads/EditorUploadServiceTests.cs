using System.Text;
using MathComps.Infrastructure.Options;
using MathComps.Infrastructure.Services.EditorUploads;
using MathComps.Infrastructure.Storage;
using MathComps.Infrastructure.Tests.TestInfrastructure;
using Moq;
using SkiaSharp;
using MsOptions = Microsoft.Extensions.Options.Options;

namespace MathComps.Infrastructure.Tests.EditorUploads;

/// <summary>
/// Tests for <see cref="EditorUploadService"/>: which files an upload takes and where it stores them, and which files a
/// link is handed out to. Files go into an in-memory store, and the links are stand-ins naming the object key they
/// were signed for, so each test reads exactly which file a link reaches.
/// </summary>
public sealed class EditorUploadServiceTests
{
    /// <summary>
    /// The uploader's Clerk user id.
    /// </summary>
    private const string UploaderId = "user_abc";

    /// <summary>
    /// A uuid, as an upload's name writes it.
    /// </summary>
    private const string UuidPattern = "[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}";

    /// <summary>
    /// The store the uploads go into.
    /// </summary>
    private readonly FakePrivateObjectStore _store = new();

    /// <summary>
    /// The service over the store and over links that name the object key they reach, taking files up to a megabyte
    /// and giving one request links to two files at most.
    /// </summary>
    private readonly EditorUploadService _service;

    /// <summary>
    /// Builds the service over the test's own store.
    /// </summary>
    public EditorUploadServiceTests()
    {
        // Files up to a megabyte of either kind
        _service = NewService(maxImageBytes: 1_000_000, maxAttachmentBytes: 1_000_000);
    }

    /// <summary>
    /// A picture goes into the uploader's own folder of pictures, under a fresh name, stored and named as the format
    /// its bytes are, so a link to it is served as what it really is. That holds for a photo whose name claims another
    /// format, which a picture saved under the wrong extension sends.
    /// </summary>
    /// <param name="format">The format the picture's bytes are.</param>
    /// <param name="mediaType">The media type the upload names.</param>
    /// <param name="storedType">The media type the picture is stored with.</param>
    /// <param name="extension">The extension its upload key ends with.</param>
    [Theory]
    [InlineData("png", "image/png", "image/png", "png")]
    [InlineData("jpeg", "image/jpeg", "image/jpeg", "jpg")]
    [InlineData("webp", "image/webp", "image/webp", "webp")]
    [InlineData("gif", "image/gif", "image/gif", "gif")]
    [InlineData("png", "image/jpeg", "image/png", "png")]
    public async Task A_picture_is_stored_as_the_format_its_bytes_are(
        string format, string mediaType, string storedType, string extension)
    {
        // A picture of the format
        var picture = BytesOf(format);

        // Uploaded under the media type
        var upload = await _service.UploadAsync(UploaderId, mediaType, new MemoryStream(picture));

        // Named in the uploader's folder of pictures, by when it went up and a uuid, with the extension of its format
        Assert.Matches($@"^abc/images/\d{{13}}-{UuidPattern}\.{extension}$", upload.Key);

        // The file stored under the uploader's whole Clerk user id
        var (stored, contentType) = _store[$"user-uploads/user_{upload.Key}"];

        // Holding the picture
        Assert.Equal(picture, stored);

        // As the format it is
        Assert.Equal(storedType, contentType);
    }

    /// <summary>
    /// An attachment goes into the uploader's own folder of attachments, under a fresh name with its format's
    /// extension, stored with the media type its upload names. A text's media type names UTF-8 as its charset, so its
    /// diacritics read right when its link is opened.
    /// </summary>
    /// <param name="mediaType">The media type the upload names.</param>
    /// <param name="content">The attachment's text.</param>
    /// <param name="storedType">The media type the attachment is stored with.</param>
    /// <param name="extension">The extension its upload key ends with.</param>
    [Theory]
    [InlineData("application/pdf", "%PDF-1.7\n%âãÏÓ", "application/pdf", "pdf")]
    [InlineData("text/plain", "Riešenie: x² = 4", "text/plain; charset=utf-8", "txt")]
    [InlineData("text/markdown", "# Úloha 1", "text/markdown; charset=utf-8", "md")]
    public async Task An_attachment_is_stored_as_its_upload_names_it(
        string mediaType, string content, string storedType, string extension)
    {
        // The attachment's bytes
        var attachment = Encoding.UTF8.GetBytes(content);

        // Uploaded under the media type
        var upload = await _service.UploadAsync(UploaderId, mediaType, new MemoryStream(attachment));

        // Named in the uploader's folder of attachments, by when it went up and a uuid, with its format's extension
        Assert.Matches($@"^abc/attachments/\d{{13}}-{UuidPattern}\.{extension}$", upload.Key);

        // The file stored under the uploader's whole Clerk user id
        var (stored, contentType) = _store[$"user-uploads/user_{upload.Key}"];

        // Holding the attachment
        Assert.Equal(attachment, stored);

        // With its media type
        Assert.Equal(storedType, contentType);
    }

    /// <summary>
    /// An upload whose bytes aren't what its media type says is refused and stores nothing, and so is a picture of a
    /// format no upload may have, and one naming a media type no file may have. A file named as a picture whatever it
    /// holds would otherwise be served as one.
    /// </summary>
    /// <param name="mediaType">The media type the upload names.</param>
    /// <param name="content">What the upload's bytes are.</param>
    [Theory]
    [InlineData("image/png", "pdf")]
    [InlineData("image/png", "bmp")]
    [InlineData("image/png", "empty")]
    [InlineData("application/pdf", "png")]
    [InlineData("text/plain", "invalid-utf8")]
    [InlineData("image/svg+xml", "svg")]
    public async Task An_upload_whose_bytes_are_not_its_media_type_is_refused(string mediaType, string content)
    {
        // Refused
        await Assert.ThrowsAsync<UploadTypeNotAllowedException>(() =>
            _service.UploadAsync(UploaderId, mediaType, new MemoryStream(BytesOf(content))));

        // With nothing stored
        Assert.Empty(_store.Keys);
    }

    /// <summary>
    /// An upload takes a file exactly as big as its kind may be, and refuses one a byte bigger, storing nothing. A
    /// picture and an attachment each go by their own size.
    /// </summary>
    /// <param name="mediaType">The media type the upload names.</param>
    /// <param name="content">What the upload's bytes are.</param>
    [Theory]
    [InlineData("image/png", "png")]
    [InlineData("text/plain", "text")]
    public async Task An_upload_takes_a_file_up_to_its_kinds_size(string mediaType, string content)
    {
        // A picture and a text of different sizes, so a kind held to the other kind's size fails
        var picture = BytesOf("png");
        var text = BytesOf("text");

        // A service taking each of them at exactly its own size
        var service = NewService(maxImageBytes: picture.Length, maxAttachmentBytes: text.Length);

        // The file the upload carries, as big as its kind may be
        var file = BytesOf(content);

        // Taken at exactly that size
        var taken = await service.UploadAsync(UploaderId, mediaType, new MemoryStream(file));

        // Refused a byte over it
        await Assert.ThrowsAsync<UploadTooLargeException>(() =>
            service.UploadAsync(UploaderId, mediaType, new MemoryStream([.. file, 0])));

        // With nothing stored but the file taken
        Assert.Equal([$"user-uploads/user_{taken.Key}"], _store.Keys);
    }

    /// <summary>
    /// A text links each uploaded file it names once, a picture and an attachment alike, and nothing else it names: a
    /// problem's figure is public and named with no folder, and a plain web link needs no signing.
    /// </summary>
    [Fact]
    public void A_text_links_each_upload_it_names_once()
    {
        // A text naming a picture twice, an attachment, a problem's figure and a web page
        const string text = """
            ![shot](media:abc/images/1-shot.png?scale=50) and again ![shot](media:abc/images/1-shot.png?scale=100)
            [📎 notes.pdf](media:xyz/attachments/2-notes.pdf)
            ![figure](media:76-mathcomps-proposals-103-p39-stvorec?width=157&height=159)
            [a page](https://example.com/page.png)
            """;

        // The links the text gets
        var links = _service.LinksIn(text);

        // One to each uploaded file, by the upload key the text names it by
        Assert.Equal(
            new Dictionary<string, string>
            {
                ["abc/images/1-shot.png"] = "read:user-uploads/user_abc/images/1-shot.png",
                ["xyz/attachments/2-notes.pdf"] = "read:user-uploads/user_xyz/attachments/2-notes.pdf",
            },
            links);
    }

    /// <summary>
    /// An uploader gets links to their own files alone. A key in another uploader's folder is left out, and so is one
    /// that is no upload key at all, which could reach out of the uploads' folder.
    /// </summary>
    [Fact]
    public void Own_links_leave_out_every_key_outside_the_uploaders_folder()
    {
        // The uploader's own picture, asked for twice, beside another uploader's and two keys that are no upload keys
        string[] keys =
        [
            "abc/images/1-shot.png",
            "abc/images/1-shot.png",
            "xyz/images/2-theirs.png",
            "abc/../../defense/blob.json",
            "abc",
        ];

        // The links the uploader gets
        var links = _service.LinksToOwnUploads(UploaderId, keys);

        // To their own picture alone
        Assert.Equal(
            new Dictionary<string, string>
            {
                ["abc/images/1-shot.png"] = "read:user-uploads/user_abc/images/1-shot.png",
            },
            links);
    }

    /// <summary>
    /// An uploader gets links to no more of their own files than one request takes, however many keys it names.
    /// </summary>
    [Fact]
    public void Own_links_stop_at_the_most_one_request_takes()
    {
        // Three of the uploader's own pictures, one more than a request takes
        string[] keys = ["abc/images/1-a.png", "abc/images/2-b.png", "abc/images/3-c.png"];

        // The links the uploader gets
        var links = _service.LinksToOwnUploads(UploaderId, keys);

        // To the first two alone
        Assert.Equal(["abc/images/1-a.png", "abc/images/2-b.png"], links.Keys.Order());
    }

    /// <summary>
    /// The service over the test's own store, taking files up to the given sizes and giving one request links to two
    /// files at most.
    /// </summary>
    /// <param name="maxImageBytes">The biggest picture it takes, in bytes.</param>
    /// <param name="maxAttachmentBytes">The biggest attachment it takes, in bytes.</param>
    /// <returns>The service.</returns>
    private EditorUploadService NewService(long maxImageBytes, long maxAttachmentBytes) =>
        // Over the store and the stand-in links
        new(_store, StandInLinks(), MsOptions.Create(new EditorUploadSettings
        {
            MaxOwnLinksPerRequest = 2,
            MaxImageBytes = maxImageBytes,
            MaxAttachmentBytes = maxAttachmentBytes,
        }));

    /// <summary>
    /// The bytes of a file an upload carries, by what they are.
    /// </summary>
    /// <param name="content">What the bytes are.</param>
    /// <returns>The bytes.</returns>
    private static byte[] BytesOf(string content) => content switch
    {
        "png" => TestPictures.Plain(1, 1, SKColors.Gray),
        "jpeg" => TestPictures.Plain(1, 1, SKColors.Gray, SKEncodedImageFormat.Jpeg),
        "webp" => TestPictures.Plain(1, 1, SKColors.Gray, SKEncodedImageFormat.Webp),
        "gif" => TestPictures.OnePixelGif,
        "bmp" =>
        [
            0x42, 0x4D, 0x3A, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x36, 0x00, 0x00, 0x00, 0x28, 0x00, 0x00, 0x00,
            0x01, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x00, 0x18, 0x00, 0x00, 0x00, 0x00, 0x00, 0x04, 0x00,
            0x00, 0x00, 0x13, 0x0B, 0x00, 0x00, 0x13, 0x0B, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0xFF, 0xFF, 0xFF, 0x00,
        ],
        "pdf" => "%PDF-1.7\n"u8.ToArray(),
        "svg" => """<svg xmlns="http://www.w3.org/2000/svg"/>"""u8.ToArray(),
        "text" => Encoding.UTF8.GetBytes(new string('x', 1000)),
        "invalid-utf8" => [0xC3, 0x28],
        "empty" => [],
        _ => throw new ArgumentOutOfRangeException(nameof(content), content, "Unknown content"),
    };

    /// <summary>
    /// Stand-in links to the private bucket, each naming what it does and the object key it reaches.
    /// </summary>
    /// <returns>The stand-in links.</returns>
    private static IPrivateFileLinks StandInLinks()
    {
        // The links
        var links = new Mock<IPrivateFileLinks>();

        // A read link names the file it reads
        links.Setup(fileLinks => fileLinks.LinkFor(It.IsAny<string>()))
            .Returns((string key) => $"read:{key}");

        // Handed out as the service's links
        return links.Object;
    }
}

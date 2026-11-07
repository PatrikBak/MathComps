using MathComps.Infrastructure.Options;
using MathComps.Infrastructure.Services.EditorUploads;
using MathComps.Infrastructure.Storage;
using Moq;
using MsOptions = Microsoft.Extensions.Options.Options;

namespace MathComps.Infrastructure.Tests.EditorUploads;

/// <summary>
/// Tests for <see cref="EditorUploadService"/>: which files a link is handed out to. The links are stand-ins naming
/// the object key they were signed for, so each test reads exactly which file a link reaches.
/// </summary>
public sealed class EditorUploadServiceTests
{
    /// <summary>
    /// The uploader's Clerk user id.
    /// </summary>
    private const string UploaderId = "user_abc";

    /// <summary>
    /// The service over links that name the object key they reach, giving one request links to two files at most.
    /// </summary>
    private readonly EditorUploadService _service = new(
        StandInLinks(), MsOptions.Create(new EditorUploadSettings { MaxOwnLinksPerRequest = 2 }));

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

using System.Collections.Immutable;
using MathComps.Domain.Contracts.EditorUploads;
using Microsoft.Extensions.Logging;

namespace MathComps.Infrastructure.Services.EditorUploads;

/// <summary>
/// A service for the files people upload into the text editor, which only the application reaches. A text names such
/// a file by its upload key after <c>media:</c> (<c>media:&lt;key&gt;</c>), and a browser reads one through a link
/// handed out here to its uploader, or by <see cref="IEditorUploadLinks"/> to a text's readers. Each uploader's files
/// sit in a folder of their own, which their upload keys start with.
/// </summary>
public interface IEditorUploadService
{
    /// <summary>
    /// Stores one file into the uploader's own folder, under a new upload key. A picture is a PNG, JPEG, WebP or GIF;
    /// an attachment is a PDF, or a plain or markdown text in UTF-8. The file's bytes must be what its media type says,
    /// except that a picture is kept as the format its bytes are, whichever picture format its media type names.
    /// </summary>
    /// <param name="uploaderId">The uploader's Clerk user id.</param>
    /// <param name="mediaType">The file's media type, as the upload names it.</param>
    /// <param name="content">The file's bytes.</param>
    /// <param name="cancellationToken">Cancels the upload.</param>
    /// <returns>The uploaded file, as a text refers to it.</returns>
    /// <exception cref="UploadTypeNotAllowedException">Thrown when the media type is none a file may have, or the
    /// bytes aren't what it says.</exception>
    /// <exception cref="UploadTooLargeException">Thrown when the file is bigger than its kind of file may
    /// be.</exception>
    Task<EditorUploadDto> UploadAsync(
        string uploaderId, string mediaType, Stream content, CancellationToken cancellationToken = default);

    /// <summary>
    /// Links to the uploader's own files among the keys. A key outside the uploader's folder, or one that is no upload
    /// key at all, is left out, and so is every file past the most one call gets links to.
    /// </summary>
    /// <param name="uploaderId">The uploader's Clerk user id.</param>
    /// <param name="keys">The files' upload keys.</param>
    /// <returns>Each of the uploader's files' link, by its upload key.</returns>
    ImmutableDictionary<string, string> LinksToOwnUploads(string uploaderId, IEnumerable<string> keys);
}

/// <summary>
/// Thrown when an upload names a media type no file uploaded into the editor may have, or carries bytes that aren't
/// what its media type says.
/// </summary>
public sealed class UploadTypeNotAllowedException()
    : MathCompsException(
        "That type of file can't be uploaded here",
        RefusalKind.Invalid,
        LogLevel.Information);

/// <summary>
/// Thrown when an upload carries a file bigger than its kind of file may be.
/// </summary>
public sealed class UploadTooLargeException()
    : MathCompsException(
        "The file is too large",
        RefusalKind.Invalid,
        LogLevel.Error);

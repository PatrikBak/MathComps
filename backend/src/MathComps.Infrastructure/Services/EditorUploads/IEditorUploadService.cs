using System.Collections.Immutable;

namespace MathComps.Infrastructure.Services.EditorUploads;

/// <summary>
/// A service for the files people upload into the text editor, which only the application reaches. A text names such
/// a file by its upload key after <c>media:</c> (<c>media:&lt;key&gt;</c>), and a browser reads one through a link
/// this service hands out. Each uploader's files sit in a folder of their own, which their upload keys start with.
/// </summary>
public interface IEditorUploadService
{
    /// <summary>
    /// Links to the files a text names, for a viewer who may read the text.
    /// </summary>
    /// <param name="text">The text, in markdown.</param>
    /// <returns>Each named file's link, by its upload key.</returns>
    ImmutableDictionary<string, string> LinksIn(string text);

    /// <summary>
    /// Links to the uploader's own files among the keys. A key outside the uploader's folder, or one that is no upload
    /// key at all, is left out, and so is every file past the most one call gets links to.
    /// </summary>
    /// <param name="uploaderId">The uploader's Clerk user id.</param>
    /// <param name="keys">The files' upload keys.</param>
    /// <returns>Each of the uploader's files' link, by its upload key.</returns>
    ImmutableDictionary<string, string> LinksToOwnUploads(string uploaderId, IEnumerable<string> keys);
}

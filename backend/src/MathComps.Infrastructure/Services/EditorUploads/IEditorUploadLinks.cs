using System.Collections.Immutable;

namespace MathComps.Infrastructure.Services.EditorUploads;

/// <summary>
/// A service handing out links to the files uploaded through the <see cref="IEditorUploadService"/>, to whoever may
/// read a text naming them.
/// </summary>
public interface IEditorUploadLinks
{
    /// <summary>
    /// Links to the files a text names, for a viewer who may read the text.
    /// </summary>
    /// <param name="text">The text, in markdown.</param>
    /// <returns>Each named file's link, by its upload key.</returns>
    ImmutableDictionary<string, string> LinksIn(string text);
}

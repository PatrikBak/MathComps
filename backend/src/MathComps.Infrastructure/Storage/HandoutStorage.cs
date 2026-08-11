using MathComps.Domain.Localization;

namespace MathComps.Infrastructure.Storage;

/// <summary>
/// Where a handout's artefacts live in object storage: its figures, its compiled PDFs, and the problem content the
/// AI examiner is served from. The handout build writes them and the API reads them back, so the layout is stated
/// once here rather than at each end. A writer and a reader that disagree about it produce a store nothing can
/// resolve from, with no error anywhere to say so.
/// </summary>
public static class HandoutStorage
{
    /// <summary>
    /// The prefix every handout artefact lives under.
    /// </summary>
    private const string Prefix = "handouts";

    /// <summary>
    /// The key a handout figure lives under. All language variants of a handout share one figure set, so the path
    /// is keyed by the language-stripped slug.
    /// </summary>
    /// <param name="slugRelativeKey">The slug-prefixed asset path, e.g. <c>factorization/box.svg</c>.</param>
    /// <returns>The object key.</returns>
    public static string AssetKey(string slugRelativeKey) => $"{Prefix}/{slugRelativeKey}";

    /// <summary>
    /// The key a compiled handout PDF lives under. Every handout's PDFs share one flat folder.
    /// </summary>
    /// <param name="fileName">The PDF's file name.</param>
    /// <returns>The object key.</returns>
    public static string PdfKey(string fileName) => AssetKey($"pdfs/{fileName}");

    /// <summary>
    /// The key one handout's examiner content lives under in one language. This is the only thing a defense target
    /// can be turned into, so it decides the file names the build has to publish.
    /// </summary>
    /// <param name="handoutContentId">The handout's permanent content id.</param>
    /// <param name="language">The language variant.</param>
    /// <returns>The object key.</returns>
    public static string DefenseContentKey(string handoutContentId, Language language) =>
        DefenseContentKeyForFile($"{handoutContentId}.{language.ToString().ToLowerInvariant()}.json");

    /// <summary>
    /// The key a generated defense-content blob is published under, given the name it was written to disk with.
    /// </summary>
    /// <param name="fileName">The blob's file name, which must be what <see cref="DefenseContentKey"/> expects.</param>
    /// <returns>The object key.</returns>
    public static string DefenseContentKeyForFile(string fileName) => AssetKey($"defense/{fileName}");
}

namespace MathComps.Infrastructure.BulkImport;

/// <summary>
/// Rewrites a draft's relative image refs (e.g. <c>images/incircle.svg</c>) to their final <c>media:</c> keys
/// (e.g. <c>media:2024-csmo-a-iii-1-incircle?width=100px&amp;height=80px</c>) inside a markdown body, once the
/// images have been uploaded and their keys are known. Pure string substitution — the upload and key/dimension
/// computation happen in the caller; this only swaps the resolved refs in.
/// </summary>
public static class MarkdownImageRewriter
{
    /// <summary>
    /// Replaces every relative image ref in <paramref name="markdown"/> with its resolved <c>media:</c> ref. A ref
    /// that doesn't appear is a no-op, so passing the full map for a body that uses only some of the images is fine.
    /// </summary>
    /// <param name="markdown">The markdown body, still carrying relative refs.</param>
    /// <param name="replacements">Map from each relative ref to its resolved <c>media:</c> ref.</param>
    /// <returns>The body with every known ref rewritten.</returns>
    public static string Rewrite(string markdown, IReadOnlyDictionary<string, string> replacements) =>
        // Fold each replacement over the body. The full relative path (extension included) is a precise token —
        // "images/a.svg" can't accidentally hit "images/ab.svg" since the boundary differs — so an ordinal
        // string replace is both safe and order-independent.
        replacements.Aggregate(markdown, (current, replacement) =>
            current.Replace(replacement.Key, replacement.Value, StringComparison.Ordinal));
}

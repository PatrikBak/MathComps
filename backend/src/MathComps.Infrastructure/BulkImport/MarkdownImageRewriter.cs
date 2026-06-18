using System.Text.RegularExpressions;

namespace MathComps.Infrastructure.BulkImport;

/// <summary>
/// Rewrites a draft's relative image refs (e.g. <c>images/incircle.svg</c>) to their final <c>media:</c> refs
/// (e.g. <c>media:2024-csmo-a-iii-1-incircle?width=100&amp;height=80</c>) inside a markdown body, once the images
/// have been uploaded and their keys and dimensions are known. The upload and key/dimension computation happen in
/// the caller; this stamps the derived dimensions onto each ref's query string, keeping an author-written
/// <c>?inline=</c> and dropping anything else (so a hand-written <c>?width=</c>/<c>?height=</c>/<c>?scale=</c> can't
/// survive into a malformed double-<c>?</c> URL).
/// </summary>
public static class MarkdownImageRewriter
{
    /// <summary>The query key an author may keep on a problem image ref — inline display. Everything else is dropped.</summary>
    private const string InlineParam = "inline";

    /// <summary>
    /// Replaces every relative image ref in <paramref name="markdown"/> with its resolved <c>media:</c> ref, the
    /// figure's intrinsic dimensions stamped onto the query string. A ref that doesn't appear is a no-op, so passing
    /// the full map for a body that uses only some of the images is fine.
    /// </summary>
    /// <param name="markdown">The markdown body, still carrying relative refs.</param>
    /// <param name="replacements">Map from each relative ref to its resolved <c>media:</c> key and dimensions.</param>
    /// <returns>The body with every known ref rewritten to its dimensioned <c>media:</c> ref.</returns>
    public static string Rewrite(string markdown, IReadOnlyDictionary<string, ResolvedImageRef> replacements)
    {
        // Nothing to replace — an empty alternation would match the empty string everywhere, so bail early.
        if (replacements.Count == 0)
            return markdown;

        // The known refs as one alternation, longest-first so a prefix-sharing ref ("images/a.svg" vs
        // "images/ab.svg") can't shadow the longer one.
        var refPattern = string.Join(
            '|',
            replacements.Keys
                .OrderByDescending(relativeRef => relativeRef.Length)
                .Select(Regex.Escape));

        // Match a ref plus its optional query; the trailing boundary stops a match inside a longer filename token
        // ("images/a.svg" inside "images/a.svgx").
        var pattern = $"(?<ref>{refPattern})(?<query>\\?[^)\\s\\]\"']*)?(?![\\w.-])";

        // Rewrite each matched ref to its dimensioned media ref.
        return Regex.Replace(markdown, pattern, match =>
        {
            // The resolved key and dimensions for the ref this match landed on.
            var resolved = replacements[match.Groups["ref"].Value];

            // Merge the author query with the derived dimensions.
            var query = BuildQuery(match.Groups["query"].Value, resolved);

            // The final dimensioned media ref.
            return $"{resolved.MediaKey}?{query}";
        });
    }

    /// <summary>
    /// Builds one image ref's resolved query string: the author's <c>inline</c> param when present (anything else
    /// they wrote is dropped), followed by the figure's derived <c>width</c>/<c>height</c>.
    /// </summary>
    /// <param name="rawQuery">The captured query as written, leading <c>?</c> and all, or empty when the ref was bare.</param>
    /// <param name="resolved">The resolved ref carrying the dimensions to stamp.</param>
    /// <returns>The query string (no leading <c>?</c>).</returns>
    private static string BuildQuery(string rawQuery, ResolvedImageRef resolved)
    {
        // Width/height are auto-derived, so inline is the only param worth keeping.
        var inline = rawQuery
            .TrimStart('?')
            .Split('&', StringSplitOptions.RemoveEmptyEntries)
            .FirstOrDefault(param =>
                param.Split('=', 2)[0].Trim().Equals(InlineParam, StringComparison.OrdinalIgnoreCase));

        // The derived dimensions always ride at the end of the query.
        var dimensions = $"width={resolved.Width}&height={resolved.Height}";

        // Inline (when the author asked for it) leads; the dimensions follow.
        return inline is null ? dimensions : $"{inline}&{dimensions}";
    }
}

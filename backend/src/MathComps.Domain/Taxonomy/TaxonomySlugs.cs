namespace MathComps.Domain.Taxonomy;

/// <summary>
/// The canonical slug formulas for the competition taxonomy — how a node and a problem are keyed across the
/// whole system (registry name maps, persisted entities, derived references). One definition so every layer
/// composes the same key; pure string logic, so it's testable on its own.
/// </summary>
public static class TaxonomySlugs
{
    /// <summary>
    /// Derives a problem's slug — <c>{editionNumber}-{competitionPath}-{order}</c>.
    /// </summary>
    /// <param name="editionNumber">The season's edition number (ročník), e.g. 75.</param>
    /// <param name="competitionPath">The competition node's path, e.g. <c>csmo-a-iii</c>.</param>
    /// <param name="order">The problem's 1-based position within the competition.</param>
    /// <returns>The problem slug (e.g. <c>75-csmo-a-iii-1</c>).</returns>
    public static string ProblemSlug(int editionNumber, string competitionPath, int order) =>
        // The path is already canonical, so just bracket it with the edition number and order.
        $"{editionNumber}-{competitionPath}-{order}";

    /// <summary>
    /// Joins a taxonomy node's own slug to its parent's path.
    /// </summary>
    /// <param name="parentPath">The parent's path, or null at a root.</param>
    /// <param name="slug">The node's own slug, which must carry no hyphen.</param>
    /// <returns>The node's path (e.g. <c>csmo-a-iii</c>).</returns>
    /// <exception cref="InvalidOperationException">Thrown when the slug is not a single path segment.</exception>
    public static string ComposePath(string? parentPath, string slug)
    {
        // A slug carrying the separator would make the path it lands in ambiguous, so refuse it at the source.
        if (!IsPathSegment(slug))
            throw new InvalidOperationException(
                $"Taxonomy slug '{slug}' is not a single path segment (lowercase letters and digits only).");

        // A root has nothing above it to join to.
        return parentPath is null ? slug : $"{parentPath}-{slug}";
    }

    /// <summary>
    /// Whether a path names a node inside another node's branch — the node itself, or anything below it. The
    /// separator has to be part of the match: without it <c>csmo-z1</c> would claim <c>csmo-z10</c>, which is a
    /// sibling and not a descendant.
    /// </summary>
    /// <param name="path">The node's path (e.g. <c>csmo-a-iii</c>).</param>
    /// <param name="branchPath">The path of the branch to test against (e.g. <c>csmo-a</c>).</param>
    /// <returns>True when the path is the branch or sits under it.</returns>
    public static bool IsAtOrUnder(string path, string branchPath) =>
        // Either it is the branch, or it extends the branch across the separator.
        path == branchPath || path.StartsWith($"{branchPath}-", StringComparison.Ordinal);

    /// <summary>
    /// Whether a slug is a single path segment, i.e. lowercase alphanumeric with no separator in it. A segment
    /// carrying the separator would collide with the branch its prefix names: <c>a-b</c> under <c>csmo</c>
    /// reads as a node of the <c>csmo-a</c> branch.
    /// </summary>
    /// <param name="slug">The slug to check.</param>
    /// <returns>True when the slug is a single segment.</returns>
    public static bool IsPathSegment(string slug) =>
        // Non-empty, and every character drawn from the canonical slug alphabet minus the separator.
        slug.Length > 0 && slug.All(character => character is (>= 'a' and <= 'z') or (>= '0' and <= '9'));
}

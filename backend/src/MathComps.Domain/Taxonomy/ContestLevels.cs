namespace MathComps.Domain.Taxonomy;

/// <summary>
/// One node on a contest's path: what it is called, how it is addressed, and where it sits among its siblings.
/// </summary>
/// <param name="Slug">The node's own slug, one path segment (e.g. <c>a</c>, <c>iii</c>).</param>
/// <param name="Path">The node's full path (e.g. <c>csmo-a-iii</c>).</param>
/// <param name="SortKey">The node's zero-padded position among its siblings, which sorts as it reads.</param>
public record ContestLevel(string Slug, string Path, string SortKey);

/// <summary>
/// A contest node read as three levels — the competition it belongs to, the category between them when there
/// is one, and the round it is. The reading is lossless while the tree runs no deeper than a round; below that
/// it keeps the outermost two levels and the node itself.
/// </summary>
/// <param name="Competition">The root the node descends from, which every node has.</param>
/// <param name="Category">The level below the competition, absent when the node is a competition or its round.</param>
/// <param name="Round">The node itself, absent when the node is a whole competition.</param>
public record ContestLevels(ContestLevel Competition, ContestLevel? Category, ContestLevel? Round)
{
    /// <summary>
    /// Reads the levels off a node's path and sort path, which carry the same chain in the same order: the
    /// slugs down to the node, and their positions.
    /// </summary>
    /// <param name="path">The node's path (e.g. <c>csmo-a-iii</c>).</param>
    /// <param name="sortPath">The node's sort path (e.g. <c>0001.0001.0004</c>).</param>
    /// <returns>The node's three-level projection.</returns>
    /// <exception cref="InvalidOperationException">Thrown when the two paths disagree on the node's depth.</exception>
    public static ContestLevels From(string path, string sortPath)
    {
        // The slugs from the root down, and their sibling positions, which pair up index by index.
        var slugs = path.Split('-');
        var sortKeys = sortPath.Split('.');

        // A node whose two paths disagree was written by something that doesn't know how they're composed.
        if (slugs.Length != sortKeys.Length)
            throw new InvalidOperationException(
                $"Contest node '{path}' has a sort path of a different depth ('{sortPath}').");

        // The root heads every chain, and its slug is its whole path.
        var competition = new ContestLevel(slugs[0], slugs[0], sortKeys[0]);

        // A category needs a level between the competition and the node, so a chain of two has none.
        var category = slugs.Length < 3 ? null
            : new ContestLevel(slugs[1], $"{slugs[0]}-{slugs[1]}", sortKeys[1]);

        // The node itself is a round whenever it is not the competition.
        var round = slugs.Length < 2 ? null
            : new ContestLevel(slugs[^1], path, sortKeys[^1]);

        // The node read as its three levels.
        return new ContestLevels(competition, category, round);
    }
}

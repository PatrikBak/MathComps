using MathComps.Domain.EfCoreEntities;

namespace MathComps.Domain.Taxonomy;

/// <summary>
/// One competition reached while descending a path — where it sits, and how it is addressed once it gets there.
/// </summary>
/// <param name="ParentPath">The path of the competition one level up, null at a root.</param>
/// <param name="Slug">The competition's own slug, one path segment.</param>
/// <param name="Path">The competition's own path, its parent's extended by that slug.</param>
public record DescendedNode(string? ParentPath, string Slug, string Path);

/// <summary>
/// The shape of the stored competition tree — how a path descends through it, and how the sort paths that order
/// it are built. Pure operations over <see cref="Competition"/> rows, so a caller loads and persists them and
/// this decides nothing about storage. One definition so the dry run, the write and the test seeds all walk the
/// tree the same way; a second walk drifting from the first is what makes a preview lie.
/// </summary>
public static class CompetitionTree
{
    /// <summary>
    /// The competitions a path runs through, root-down — the whole chain, the addressed competition last. Each
    /// step names the generation it sits in (by its parent's path), which is what places it among its siblings.
    /// </summary>
    /// <param name="path">The path to descend (e.g. <c>csmo-a-iii</c>).</param>
    /// <returns>One entry per segment, from the root down.</returns>
    /// <exception cref="InvalidOperationException">Thrown when a segment is not a single path segment.</exception>
    public static IEnumerable<DescendedNode> Descend(string path)
    {
        // The competition the walk has reached, still null above the roots.
        string? parentPath = null;

        // One generation per segment, from the root down.
        foreach (var slug in path.Split('-'))
        {
            // Where this segment lands, which is also how it is addressed.
            var nodePath = TaxonomySlugs.ComposePath(parentPath, slug);

            // The step itself, carrying the generation it sits in.
            yield return new DescendedNode(parentPath, slug, nodePath);

            // Everything below extends the path just reached.
            parentPath = nodePath;
        }
    }

    /// <summary>
    /// Builds a competition's sort path: its parent's, extended by its own zero-padded position. A root extends
    /// nothing, so it carries that position alone.
    /// </summary>
    /// <param name="parentSortPath">The parent's sort path, or null at a root.</param>
    /// <param name="sortOrder">The competition's 1-based position among its siblings.</param>
    /// <returns>The sort path (e.g. <c>0001.0001.0004</c>).</returns>
    public static string ComposeSortPath(string? parentSortPath, int sortOrder) =>
        // A root has nothing above it to extend.
        parentSortPath is null ? $"{sortOrder:D4}" : $"{parentSortPath}.{sortOrder:D4}";

    /// <summary>
    /// Rewrites every competition's sort path from the sibling orders the rows currently carry, walking root-down
    /// so each one extends the path above it. Restamping the whole tree is what a renumbering anywhere in it
    /// needs: a sort path reads down the entire chain, so moving one competition invalidates every path below it.
    /// </summary>
    /// <param name="nodes">Every competition in the tree — a partial set would strand the branches it omits.</param>
    public static void RestampSortPaths(IReadOnlyCollection<Competition> nodes)
    {
        // The children of each competition, under the parent id a root leaves null.
        var childrenByParent = nodes.ToLookup(node => node.ParentId);

        // Stamps one generation and recurses into everything below it.
        void Stamp(Guid? parentId, string? parentSortPath)
        {
            // Every competition one level below the one being stamped.
            foreach (var child in childrenByParent[parentId])
            {
                // The child extends its parent's path with its own position.
                child.SortPath = ComposeSortPath(parentSortPath, child.SortOrder);

                // Everything below the child extends what it was just given.
                Stamp(child.Id, child.SortPath);
            }
        }

        // Start at the roots, which extend nothing.
        Stamp(parentId: null, parentSortPath: null);
    }
}

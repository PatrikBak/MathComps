using System.Collections.Immutable;
using MathComps.Domain.Resources;

namespace MathComps.Domain.Taxonomy;

/// <summary>
/// Language-neutral structure of the competition taxonomy, deserialized from
/// <see cref="ResourcePaths.SharedMetadataFileName"/>: the tree of competition nodes, at any depth, where a node's
/// position among its siblings is its sort order.
/// </summary>
/// <param name="Nodes">The roots — whole competitions — in display order.</param>
public record SharedMetadata(ImmutableArray<SharedNode> Nodes)
{
    /// <summary>
    /// The node a path addresses, at whatever depth it sits.
    /// </summary>
    /// <param name="path">The node's path (e.g. "csmo", "csmo-a", "csmo-a-iii").</param>
    /// <returns>The structural entry, or null when the registry doesn't carry it.</returns>
    public SharedNode? Node(string path)
    {
        // The node the descent has reached, still null above the roots.
        SharedNode? current = null;

        // One generation per segment, from the root down.
        foreach (var slug in path.Split('-'))
        {
            // The generation to look in — the roots at the first segment, the current node's children after that.
            var generation = current is null ? Nodes : current.Children ?? [];

            // The node this segment names, if that generation carries one.
            current = generation.FirstOrDefault(candidate => candidate.Slug == slug);

            // A segment naming nothing means the whole path names nothing.
            if (current is null)
                return null;
        }

        // The node the last segment landed on.
        return current;
    }

    /// <summary>
    /// The slugs a node can carry one level down, in registry order — which is what numbers that generation.
    /// A slug listed here need not have a row yet: position is absolute, so a node the registry lists but no
    /// draft has introduced leaves its slot empty rather than packing the rest down.
    /// </summary>
    /// <param name="parentPath">The parent's path, or null for the roots.</param>
    /// <returns>The child slugs in order; empty at a leaf, or when the registry doesn't carry the parent.</returns>
    public ImmutableArray<string> ChildSlugs(string? parentPath) =>
        [.. (parentPath is null ? Nodes : Node(parentPath)?.Children ?? []).Select(node => node.Slug)];

    /// <summary>
    /// A node's sort order — its 1-based position among its siblings.
    /// </summary>
    /// <param name="path">The node's path (e.g. "csmo-a-iii").</param>
    /// <returns>The 1-based sort order.</returns>
    /// <exception cref="InvalidOperationException">Thrown when the node has no structural entry.</exception>
    public int SortOrder(string path)
    {
        // A node is ordered among the children of whatever sits above it; a root has nothing above it.
        var separator = path.LastIndexOf('-');
        var siblings = ChildSlugs(separator < 0 ? null : path[..separator]);
        var slug = separator < 0 ? path : path[(separator + 1)..];

        // Position in that generation is the sort order — a hit returns a 1-based order, a miss returns 0.
        var order = siblings.Select((candidate, index) => candidate == slug ? index + 1 : 0)
            .FirstOrDefault(found => found > 0);

        // A node the registry can't place has no order to give it.
        return order > 0
            ? order
            : throw new InvalidOperationException(
                $"No structural entry for competition '{path}' in {ResourcePaths.SharedMetadataFileName}.");
    }
}

/// <summary>
/// Structural entry for a single competition node.
/// </summary>
/// <param name="Slug">The node's own slug, one path segment (e.g. "csmo", "a", "iii").</param>
/// <param name="Children">
/// The nodes one level down, in sort order, or null at a leaf — which is what a competition running as one flat
/// sitting (IMO, EGMO) looks like, and what a round looks like until something nests below it.
/// </param>
public record SharedNode(string Slug, ImmutableArray<SharedNode>? Children);

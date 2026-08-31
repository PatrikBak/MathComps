using System.Collections.Immutable;
using MathComps.Domain.EfCoreEntities;
using MathComps.Domain.Taxonomy;
using MathComps.Infrastructure.Persistence;

namespace MathComps.Infrastructure.BulkImport;

/// <summary>
/// Brings one generation of the competition tree back in line with its registry positions. The preview side computes
/// the renumbering read-only (<see cref="ComputeChanges"/>); apply performs it (<see cref="ResequenceAsync"/>)
/// with a park-past-the-end, then number-1..N two-phase update so the per-parent unique sort-order index is never
/// transiently violated. A node the registry doesn't know (a target of null) is left untouched — the orphan is
/// reported elsewhere.
/// </summary>
public static class TaxonomyResequencer
{
    /// <summary>
    /// The registry-order lookup for one generation: a node's 1-based position among the children the registry
    /// lists for a parent, or null when the registry doesn't carry it. Keyed by path, since that is what
    /// addresses a node across the whole tree. Position is absolute rather than packed, so a slug the registry
    /// lists but no draft has introduced leaves its slot empty rather than packing the rest down.
    /// </summary>
    /// <param name="shared">The taxonomy registry.</param>
    /// <param name="parentPath">The parent whose children this generation is, or null for the roots.</param>
    /// <returns>The order lookup for that generation.</returns>
    public static Func<string, int?> ChildOrder(SharedMetadata shared, string? parentPath)
    {
        // Index each child path to its 1-based place in the registry.
        var orderByPath = shared.ChildSlugs(parentPath)
            .Select((slug, index) => (Path: TaxonomySlugs.ComposePath(parentPath, slug), Order: index + 1))
            .ToDictionary(entry => entry.Path, entry => entry.Order);

        // A known path yields its order; anything else yields null.
        return path => orderByPath.TryGetValue(path, out var order) ? order : null;
    }

    /// <summary>
    /// The read-only renumbering: each node whose registry target differs from its stored order, as a change.
    /// </summary>
    /// <param name="rows">The stored nodes as <c>(path, current order)</c>.</param>
    /// <param name="registryOrderOf">The registry order for a path, or null when the path is unregistered.</param>
    /// <returns>One change per node that moves; empty when the generation already matches the registry.</returns>
    public static ImmutableArray<SortOrderChange> ComputeChanges(
        IReadOnlyList<(string Path, int CurrentOrder)> rows,
        Func<string, int?> registryOrderOf)
    {
        // Accumulate one change per node that actually moves.
        var changes = ImmutableArray.CreateBuilder<SortOrderChange>();

        // Walk each stored node.
        foreach (var (path, currentOrder) in rows)
        {
            // Its registry order — null when the path is unregistered (an orphan, left alone).
            var target = registryOrderOf(path);

            // A registered node whose stored order drifted from the registry is a move; record it.
            if (target is { } targetOrder && targetOrder != currentOrder)
                changes.Add(new SortOrderChange(path, currentOrder, targetOrder));
        }

        // The nodes that move.
        return changes.ToImmutable();
    }

    /// <summary>
    /// Renumbers one generation's tracked nodes to their registry positions, two-phase so the unique sort-order
    /// index is never transiently violated: park every mover past both the live orders and the registry targets,
    /// flush, then drop each onto its target (every target sits below the parked range, so no statement collides).
    /// Both phases run in one transaction so a mid-run failure can't leave parked values committed. A no-op when
    /// nothing drifted.
    /// </summary>
    /// <param name="context">The tracking write context.</param>
    /// <param name="siblings">Every tracked node in the generation (movers and non-movers alike).</param>
    /// <param name="registryOrderOf">The registry order for a path, or null when the path is unregistered.</param>
    /// <returns>The renumbering performed; empty when nothing moved.</returns>
    public static async Task<ImmutableArray<SortOrderChange>> ResequenceAsync(
        MathCompsDbContext context,
        IReadOnlyList<Competition> siblings,
        Func<string, int?> registryOrderOf)
    {
        // Pair each node with its registry target, keeping only the ones that actually move (orphans target null).
        var movers = siblings
            .Select(node => (Node: node, Target: registryOrderOf(node.Path)))
            .Where(pair => pair.Target is { } target && target != pair.Node.SortOrder)
            .Select(pair => (pair.Node, Target: pair.Target!.Value))
            .ToList();

        // Nothing drifted — leave the DB untouched.
        if (movers.Count == 0)
            return [];

        // Snapshot the renumbering for the report before the orders are mutated.
        var changes = movers
            .Select(mover => new SortOrderChange(mover.Node.Path, mover.Node.SortOrder, mover.Target))
            .ToImmutableArray();

        // One transaction so a failure between the two phases can't leave parked values committed. A caller that
        // is already holding one covers both phases itself, and a second one over the same connection is refused.
        await using var transaction = context.Database.CurrentTransaction is null
            ? await context.Database.BeginTransactionAsync()
            : null;

        // The park base sits above every current order and every order about to be claimed, so parked values
        // collide with nothing still live and no final lands on a slot a mover is still parked in. A registry
        // that grew since the generation was stored puts targets above the stored orders, so the highest target
        // has to count too.
        var parkBase = Math.Max(siblings.Max(node => node.SortOrder), movers.Max(mover => mover.Target));

        // Park each mover just past the end — distinct, positive values above every retained order.
        for (var index = 0; index < movers.Count; index++)
            movers[index].Node.SortOrder = parkBase + index + 1;

        // Flush so the slots the movers vacated are free for the finals.
        await context.SaveChangesAsync();

        // Drop each mover onto its registry order; every target sits below the still-parked range.
        foreach (var (node, target) in movers)
            node.SortOrder = target;

        // Flush the finals.
        await context.SaveChangesAsync();

        // Commit both phases atomically, unless the caller's own transaction is what will.
        if (transaction is not null)
            await transaction.CommitAsync();

        // The renumbering performed.
        return changes;
    }
}

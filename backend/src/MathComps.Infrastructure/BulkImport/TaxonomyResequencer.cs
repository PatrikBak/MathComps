using System.Collections.Immutable;
using MathComps.Domain.Taxonomy;
using MathComps.Infrastructure.Persistence;

namespace MathComps.Infrastructure.BulkImport;

/// <summary>
/// Brings a taxonomy family's stored sort orders back in line with their registry positions. The preview side
/// computes the renumbering read-only (<see cref="ComputeChanges"/>); apply performs it
/// (<see cref="ResequenceAsync{TEntity}"/>) with a park-past-the-end, then number-1..N two-phase update so the
/// per-row unique sort-order index is never transiently violated. A slug the registry doesn't know (a target of
/// null) is left untouched — the orphan is reported elsewhere.
/// </summary>
public static class TaxonomyResequencer
{
    /// <summary>
    /// The registry-order lookups for the three taxonomy families a draft can shift: the global competition and
    /// category spaces, and the rounds of one competition. Each returns a slug's 1-based registry position, or null
    /// when the registry doesn't carry it. Keeping the trio (and the round's competition-scoping) in one place keeps
    /// the read-only preview and the mutating apply reconciling against exactly the same orders.
    /// </summary>
    /// <param name="shared">The taxonomy registry.</param>
    /// <param name="competitionSlug">The competition whose round list backs the round lookup.</param>
    /// <returns>The competition, category and round order lookups.</returns>
    public static (Func<string, int?> Competition, Func<string, int?> Category, Func<string, int?> Round) RegistryOrders(
        SharedMetadata shared, string competitionSlug)
    {
        // The target competition's registry entry backs the round lookup; a missing one yields an empty round space.
        var competition = shared.Competitions.FirstOrDefault(entry => entry.Slug == competitionSlug);

        // The three families' lookups, each over the registry's sort order.
        return (
            OrderLookup(shared.Competitions.Select(entry => entry.Slug)),
            OrderLookup(shared.Categories),
            OrderLookup(competition?.Rounds ?? []));
    }

    /// <summary>
    /// Builds a registry-order lookup over an ordered slug sequence: a slug's 1-based position, or null when the
    /// sequence doesn't carry it (an unregistered or removed slug).
    /// </summary>
    /// <param name="orderedSlugs">The registry slugs, in their sort order.</param>
    /// <returns>The lookup.</returns>
    private static Func<string, int?> OrderLookup(IEnumerable<string> orderedSlugs)
    {
        // Index each slug to its 1-based position.
        var orderBySlug = orderedSlugs
            .Select((slug, index) => (Slug: slug, Order: index + 1))
            .ToDictionary(entry => entry.Slug, entry => entry.Order);

        // A known slug yields its order; anything else yields null.
        return slug => orderBySlug.TryGetValue(slug, out var order) ? order : null;
    }

    /// <summary>
    /// The read-only renumbering: each row whose registry target differs from its stored order, as a change.
    /// </summary>
    /// <param name="kind">The kind of taxonomy entity these rows are.</param>
    /// <param name="rows">The stored rows as <c>(slug, current order)</c> — a round's plain slug.</param>
    /// <param name="metadataOrderOf">The registry order for a slug, or null when the slug is unregistered.</param>
    /// <returns>One change per row that moves; empty when the family already matches the registry.</returns>
    public static ImmutableArray<SortOrderChange> ComputeChanges(
        TaxonomyKind kind,
        IReadOnlyList<(string Slug, int CurrentOrder)> rows,
        Func<string, int?> metadataOrderOf)
    {
        // Accumulate one change per row that actually moves.
        var changes = ImmutableArray.CreateBuilder<SortOrderChange>();

        // Walk each stored row.
        foreach (var (slug, currentOrder) in rows)
        {
            // Its registry order — null when the slug is unregistered (an orphan, left alone).
            var target = metadataOrderOf(slug);

            // A registered row whose stored order drifted from the registry is a move; record it.
            if (target is { } targetOrder && targetOrder != currentOrder)
                changes.Add(new SortOrderChange(kind, slug, currentOrder, targetOrder));
        }

        // The rows that move.
        return changes.ToImmutable();
    }

    /// <summary>
    /// Renumbers a family's tracked rows to their registry positions, two-phase so the unique sort-order index is
    /// never transiently violated: park every mover just past the live range, flush, then drop each onto its target
    /// (all targets sit below the parked range, so no statement collides). Both phases run in one transaction so a
    /// mid-run failure can't leave parked values committed. A no-op when nothing drifted.
    /// </summary>
    /// <typeparam name="TEntity">The tracked entity type (competition, category or round).</typeparam>
    /// <param name="context">The tracking write context.</param>
    /// <param name="kind">The kind of taxonomy entity these rows are, for the returned changes.</param>
    /// <param name="rows">Every tracked row in the scope (movers and non-movers alike).</param>
    /// <param name="slugOf">Reads a row's slug (a round's plain slug).</param>
    /// <param name="getOrder">Reads a row's stored sort order.</param>
    /// <param name="setOrder">Writes a row's sort order.</param>
    /// <param name="metadataOrderOf">The registry order for a slug, or null when the slug is unregistered.</param>
    /// <returns>The renumbering performed; empty when nothing moved.</returns>
    public static async Task<ImmutableArray<SortOrderChange>> ResequenceAsync<TEntity>(
        MathCompsDbContext context,
        TaxonomyKind kind,
        IReadOnlyList<TEntity> rows,
        Func<TEntity, string> slugOf,
        Func<TEntity, int> getOrder,
        Action<TEntity, int> setOrder,
        Func<string, int?> metadataOrderOf)
        where TEntity : class
    {
        // Pair each row with its registry target, keeping only the ones that actually move (orphans target null).
        var movers = rows
            .Select(row => (Row: row, Target: metadataOrderOf(slugOf(row))))
            .Where(pair => pair.Target is { } target && target != getOrder(pair.Row))
            .Select(pair => (pair.Row, Target: pair.Target!.Value))
            .ToList();

        // Nothing drifted — leave the DB untouched.
        if (movers.Count == 0)
            return [];

        // Snapshot the renumbering for the report before the orders are mutated.
        var changes = movers
            .Select(mover => new SortOrderChange(kind, slugOf(mover.Row), getOrder(mover.Row), mover.Target))
            .ToImmutableArray();

        // One transaction so a failure between the two phases can't leave parked values committed.
        await using var transaction = await context.Database.BeginTransactionAsync();

        // The park base sits above every current order, so parked values collide with nothing still live.
        var parkBase = rows.Max(getOrder);

        // Park each mover just past the end — distinct, positive values above every retained order.
        for (var index = 0; index < movers.Count; index++)
            setOrder(movers[index].Row, parkBase + index + 1);

        // Flush so the slots the movers vacated are free for the finals.
        await context.SaveChangesAsync();

        // Drop each mover onto its registry order; every target sits below the still-parked range.
        foreach (var (row, target) in movers)
            setOrder(row, target);

        // Flush the finals.
        await context.SaveChangesAsync();

        // Commit both phases atomically.
        await transaction.CommitAsync();

        // The renumbering performed.
        return changes;
    }
}

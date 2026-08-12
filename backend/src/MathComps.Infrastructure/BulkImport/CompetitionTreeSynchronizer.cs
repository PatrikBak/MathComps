using System.Collections.Immutable;
using Microsoft.EntityFrameworkCore;
using MathComps.Domain.EfCoreEntities;
using MathComps.Domain.Taxonomy;
using MathComps.Infrastructure.Persistence;

namespace MathComps.Infrastructure.BulkImport;

/// <summary>
/// Raises the chain of competitions a draft target names — its brand, its category when it has one, its round
/// when it has one — each created if missing and numbered by its position among the siblings that actually
/// exist. A default round names nothing of its own and stops the chain at the brand, which is the competition
/// its problems hang under.
/// </summary>
public static class CompetitionTreeSynchronizer
{
    /// <summary>
    /// Ensures every competition on the path a draft target names exists, and hands back the whole chain.
    /// </summary>
    /// <param name="context">The tracking write context.</param>
    /// <param name="registry">The taxonomy registry, which orders each level's siblings.</param>
    /// <param name="target">The draft taxonomy naming the chain.</param>
    /// <returns>The chain root-first, each entry paired with whether it was reused or created.</returns>
    public static async Task<ImmutableArray<(Competition Competition, ResolutionAction Action)>> EnsureChainAsync(
        MathCompsDbContext context, SharedMetadata registry, DraftTarget target)
    {
        // The brand's registry entry, which orders both the categories and the rounds below it.
        var brandEntry = registry.Competition(target.CompetitionSlug);

        // Every brand slug the registry carries, which is the order the roots read in.
        var brandOrder = registry.Competitions.Select(entry => entry.Slug).ToList();

        // The chain so far, root-first, filled in as the walk descends.
        var chain = ImmutableArray.CreateBuilder<(Competition Competition, ResolutionAction Action)>();

        // The brand is a root.
        chain.Add(await EnsureAsync(context, parent: null, target.CompetitionSlug, brandOrder));

        // A category sits between the brand and its rounds, ordered among the brand's own categories.
        if (target.CategorySlug is { } categorySlug)
        {
            // A brand carrying no categories can place none, which the ensure below reports as a gap.
            var categoryOrder = brandEntry.Categories?.ToList() ?? [];

            // The category hangs off the brand.
            chain.Add(await EnsureAsync(context, chain[^1].Competition, categorySlug, categoryOrder));
        }

        // An explicit round hangs off whatever the chain reached, ordered among the brand's rounds.
        if (target.RoundSlug is { } roundSlug)
            chain.Add(await EnsureAsync(context, chain[^1].Competition, roundSlug, [.. brandEntry.Rounds]));

        // Sort paths read down the whole chain, so any renumbering above rewrites them below too.
        await RewriteSortPathsAsync(context);

        // The chain, root-first.
        return chain.ToImmutable();
    }

    /// <summary>
    /// Get-or-creates one competition under a parent, renumbering any sibling that drifted from its registry
    /// position. Position is absolute rather than packed, so a level reads the same whether or not every slug
    /// the registry lists has a row: a category that never ran the school round leaves that slot empty.
    /// </summary>
    /// <param name="context">The tracking write context.</param>
    /// <param name="parent">The competition above, or null when this one is a root.</param>
    /// <param name="slug">The competition's own slug.</param>
    /// <param name="registryOrder">Every slug this level can carry, in registry order.</param>
    /// <returns>The competition, paired with whether it was reused or created.</returns>
    /// <exception cref="InvalidOperationException">Thrown when the registry can't place the slug.</exception>
    private static async Task<(Competition Competition, ResolutionAction Action)> EnsureAsync(
        MathCompsDbContext context, Competition? parent, string slug, IReadOnlyList<string> registryOrder)
    {
        // The path addresses it across the whole tree, and refuses a slug that isn't one segment.
        var path = TaxonomySlugs.ComposePath(parent?.Path, slug);

        // The rows already sitting under this parent, the wanted one possibly among them.
        var siblings = parent is null
            ? await context.Competitions.Where(candidate => candidate.ParentId == null).ToListAsync()
            : await context.Competitions.Where(candidate => candidate.ParentId == parent.Id).ToListAsync();

        // Where each slug this level can carry sits, which is its 1-based place in the registry.
        var orderBySlug = registryOrder
            .Select((candidate, index) => (Slug: candidate, Order: index + 1))
            .ToDictionary(entry => entry.Slug, entry => entry.Order);

        // A slug the registry doesn't carry cannot be placed among its siblings at all.
        if (!orderBySlug.TryGetValue(slug, out var order))
            throw new InvalidOperationException($"Competition '{path}' has no structural entry to order it by.");

        // The siblings the newcomer shifts, which have to vacate their slots before anything claims them.
        var movers = siblings
            .Where(sibling => orderBySlug.TryGetValue(sibling.Slug, out var target) && target != sibling.SortOrder)
            .ToList();

        // Park them past the end so no single update collides, then flush to free the slots they leave.
        if (movers.Count > 0)
        {
            // Above every order still live, so a parked value can meet nothing on its way.
            var parkBase = siblings.Max(sibling => sibling.SortOrder);

            // Each mover gets a slot of its own up there, so they don't collide with each other either.
            for (var index = 0; index < movers.Count; index++)
                movers[index].SortOrder = parkBase + index + 1;

            // Write the parking, which is what frees the slots below.
            await context.SaveChangesAsync();
        }

        // Drop each mover onto its registry position, all of which sit below the parked range.
        movers.ForEach(mover => mover.SortOrder = orderBySlug[mover.Slug]);

        // The row this level already carries for the slug, null until some draft introduces it.
        var existing = siblings.FirstOrDefault(candidate => candidate.Slug == slug);

        // An existing row only needed the renumbering.
        if (existing is not null)
        {
            // The position the registry gives it.
            existing.SortOrder = order;

            // Write the renumbering this level just took.
            await context.SaveChangesAsync();

            // The row that was already standing here.
            return (existing, ResolutionAction.Reuse);
        }

        // A new row joins at the position just computed. Its sort path is stamped once the chain is in place.
        var created = new Competition
        {
            ParentId = parent?.Id,
            Slug = slug,
            Path = path,
            SortPath = "",
            SortOrder = order,
        };

        // Track the newcomer.
        await context.Competitions.AddAsync(created);

        // Flush so it has an identity the next level down can hang off.
        await context.SaveChangesAsync();

        // The newly created row.
        return (created, ResolutionAction.Create);
    }

    /// <summary>
    /// Rewrites every sort path from the tree's current sibling orders, walking root-down so each row appends
    /// its own position to the one above it.
    /// </summary>
    /// <param name="context">The tracking write context.</param>
    private static async Task RewriteSortPathsAsync(MathCompsDbContext context)
    {
        // The whole tree, which is small enough to walk in memory.
        var competitions = await context.Competitions.ToListAsync();

        // The children of each row, under the parent id a root leaves null.
        var childrenByParent = competitions.ToLookup(competition => competition.ParentId);

        // Stamps one generation and recurses into everything below it.
        void Stamp(Guid? parentId, string parentSortPath)
        {
            // Every row one level below the one being stamped.
            foreach (var child in childrenByParent[parentId])
            {
                // The child extends its parent's path with its own zero-padded position.
                child.SortPath = parentSortPath == ""
                    ? $"{child.SortOrder:D4}"
                    : $"{parentSortPath}.{child.SortOrder:D4}";

                // Everything below the child extends what it was just given.
                Stamp(child.Id, child.SortPath);
            }
        }

        // Start at the roots, which extend nothing.
        Stamp(null, "");

        // Persist the rewritten paths.
        await context.SaveChangesAsync();
    }
}

using System.Collections.Immutable;
using MathComps.Domain.EfCoreEntities;
using MathComps.Domain.Taxonomy;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Localization;
using Microsoft.EntityFrameworkCore;

namespace MathComps.Infrastructure.BulkImport;

/// <summary>
/// EF Core implementation of <see cref="ICompetitionTreeWriter"/>, ordering every generation it descends through
/// by <see cref="IMetadataLocalizationService"/>'s registry.
/// </summary>
/// <param name="metadata">The registry, which orders every generation of the competition tree.</param>
public class CompetitionTreeWriter(IMetadataLocalizationService metadata) : ICompetitionTreeWriter
{
    /// <inheritdoc/>
    public async Task<CompetitionNodeResolution> ResolveNodeAsync(MathCompsDbContext context, string path)
    {
        // The chain and the renumbering, filled in as the walk descends.
        var chain = ImmutableArray.CreateBuilder<EntityResolution>();
        var changes = ImmutableArray.CreateBuilder<SortOrderChange>();

        // The node the walk has reached, still null above the roots.
        Competition? parent = null;

        // One generation per segment, from the root down.
        foreach (var (parentPath, slug, nodePath) in CompetitionTree.Descend(path))
        {
            // Every node already sitting in this generation, the wanted one possibly among them.
            var parentId = parent?.Id;
            var siblings = await context.Competitions
                .Where(candidate => candidate.ParentId == parentId).ToListAsync();

            // Bring the generation in line with the registry before the newcomer claims a slot in it.
            var registryOrderOf = TaxonomyResequencer.ChildOrder(metadata.Shared, parentPath);
            changes.AddRange(await TaxonomyResequencer.ResequenceAsync(context, siblings, registryOrderOf));

            // A node the registry doesn't carry can't be placed among its siblings at all.
            var order = registryOrderOf(nodePath)
                ?? throw new InvalidOperationException(
                    $"Competition '{nodePath}' has no structural entry to order it by.");

            // The node this generation already carries for the slug, null until something introduces it.
            var existing = siblings.FirstOrDefault(candidate => candidate.Slug == slug);

            // Reuse what's already standing, or raise it at the position just computed.
            parent = existing ?? new Competition
            {
                ParentId = parentId,
                Slug = slug,
                Path = nodePath,
                SortPath = CompetitionTree.ComposeSortPath(parent?.SortPath, order),
                SortOrder = order
            };
            chain.Add(new EntityResolution(
                "competition", nodePath, existing is null ? ResolutionAction.Create : ResolutionAction.Reuse));

            // A newcomer has to land before the next generation can hang off its identity.
            if (existing is null)
                await context.Competitions.AddAsync(parent);

            // Flush either way: the reuse path may still be carrying this generation's renumbering.
            await context.SaveChangesAsync();
        }

        // A sort path reads down the whole chain, so a renumbering above invalidates every path below it.
        if (changes.Count > 0)
        {
            // The whole tree, which is small enough to restamp in memory.
            var nodes = await context.Competitions.ToListAsync();

            // Rebuild every path from the orders the renumbering left behind.
            CompetitionTree.RestampSortPaths(nodes);

            // Persist the rewritten paths.
            await context.SaveChangesAsync();
        }

        // The deepest node, the chain that reached it, and what moved on the way.
        return new CompetitionNodeResolution(parent!, chain.ToImmutable(), changes.ToImmutable());
    }

    /// <inheritdoc/>
    public async Task<SeasonResolution> GetOrCreateSeasonAsync(MathCompsDbContext context, int startYear)
    {
        // Reuse the existing season when present.
        var existing = await context.Seasons.FirstOrDefaultAsync(season => season.StartYear == startYear);
        if (existing is not null)
            return new SeasonResolution(existing, ResolutionAction.Reuse);

        // Otherwise create it, the edition number being the shared ročník derived from the year.
        var created = new Season { StartYear = startYear, EditionNumber = Season.EditionFromStartYear(startYear) };
        await context.Seasons.AddAsync(created);
        return new SeasonResolution(created, ResolutionAction.Create);
    }
}

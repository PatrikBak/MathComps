using MathComps.Domain.EfCoreEntities;
using MathComps.Domain.Taxonomy;
using MathComps.Infrastructure.Persistence;

namespace MathComps.Infrastructure.Tests.TestInfrastructure;

/// <summary>
/// Seeds competitions with the tree fields filled in, keyed the way a competition is addressed everywhere else: by
/// its path, whose segments are the chain of competitions down to it.
/// </summary>
public static class CompetitionTreeSeed
{
    /// <summary>
    /// Tracks a root competition at a chosen position, for a seed that cares which order the roots read in.
    /// Anything below it is placed by <see cref="Chain"/>, which finds this one by its path.
    /// </summary>
    /// <param name="context">The seeding context.</param>
    /// <param name="slug">The competition's slug, which is also its path.</param>
    /// <param name="sortOrder">Its position among the roots.</param>
    public static void Root(MathCompsDbContext context, string slug, int sortOrder) =>
        // A root extends nothing, so its path is its slug and its sort path its own position.
        context.Competitions.Add(new Competition
        {
            Id = Guid.NewGuid(),
            Slug = slug,
            Path = slug,
            SortPath = CompetitionTree.ComposeSortPath(parentSortPath: null, sortOrder),
            SortOrder = sortOrder,
        });

    /// <summary>
    /// Tracks the chain a path names, reusing whatever is already there, and hands back the deepest one — the
    /// competition a seeded round hangs under.
    /// </summary>
    /// <param name="context">The seeding context.</param>
    /// <param name="competitionPath">The competition's path (e.g. <c>csmo-a-i</c>, <c>imo</c>).</param>
    /// <returns>The deepest competition on the chain.</returns>
    public static Competition Chain(MathCompsDbContext context, string competitionPath)
    {
        // The competition the walk has reached, still null before the root is placed.
        Competition? competition = null;

        // Each segment hangs off the one before it, the first being a root.
        foreach (var (_, slug, path) in CompetitionTree.Descend(competitionPath))
        {
            // The parent this segment hangs off, captured before the local is reassigned.
            var parent = competition;

            // Reuse what an earlier round already placed, whether this seed is still building it or an earlier
            // one already persisted it, so sibling rounds share their ancestors.
            competition = context.Competitions.Local.FirstOrDefault(candidate => candidate.Path == path)
                ?? context.Competitions.FirstOrDefault(candidate => candidate.Path == path);

            // Everything below is placing a segment that isn't there yet.
            if (competition is not null)
                continue;

            // The last position taken under this parent, counting what a previous seed already persisted.
            var sortOrder = LastSortOrder(context, parent) + 1;

            // The segment itself, its sort path extending whatever the parent already holds.
            competition = new Competition
            {
                Id = Guid.NewGuid(),
                ParentId = parent?.Id,
                Slug = slug,
                Path = path,
                SortPath = CompetitionTree.ComposeSortPath(parent?.SortPath, sortOrder),
                SortOrder = sortOrder,
            };

            // Track it, so the segment below finds it without a round-trip.
            context.Competitions.Add(competition);
        }

        // The deepest segment, which the round hangs under.
        return competition!;
    }

    /// <summary>
    /// The highest sibling position under a parent, zero when it has no children yet. Reads both what this
    /// context is still building and what is already stored, since a seed can span several contexts.
    /// </summary>
    /// <param name="context">The seeding context.</param>
    /// <param name="parent">The competition whose children to measure, null for the roots.</param>
    /// <returns>The highest position taken.</returns>
    private static int LastSortOrder(MathCompsDbContext context, Competition? parent)
    {
        // The rows this context is still building, which a query against the database would not see.
        var pending = context.Competitions.Local
            .Where(candidate => candidate.ParentId == parent?.Id)
            .Select(candidate => candidate.SortOrder)
            .DefaultIfEmpty(0)
            .Max();

        // The rows already stored, which a root and a child reach by different predicates. An empty generation
        // aggregates to a SQL null, which is what the nullable projection reads back as zero.
        var stored = parent is null
            ? context.Competitions.Where(candidate => candidate.ParentId == null)
                .Max(candidate => (int?)candidate.SortOrder) ?? 0
            : context.Competitions.Where(candidate => candidate.ParentId == parent.Id)
                .Max(candidate => (int?)candidate.SortOrder) ?? 0;

        // Whichever source reached further.
        return Math.Max(pending, stored);
    }
}

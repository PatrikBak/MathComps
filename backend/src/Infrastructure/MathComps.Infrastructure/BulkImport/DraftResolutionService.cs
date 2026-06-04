using System.Collections.Immutable;
using MathComps.Infrastructure.Persistence;
using MathComps.Shared.Localization;
using Microsoft.EntityFrameworkCore;

namespace MathComps.Infrastructure.BulkImport;

/// <summary>
/// EF Core implementation of <see cref="IDraftResolutionService"/>. Spins up a short-lived, no-tracking
/// <see cref="MathCompsDbContext"/> per call and resolves each entity with an <c>AnyAsync</c> existence probe,
/// so the preview reads nothing into memory.
/// </summary>
/// <param name="dbContextFactory">Factory for creating read-only database contexts.</param>
public class DraftResolutionService(IDbContextFactory<MathCompsDbContext> dbContextFactory) : IDraftResolutionService
{
    /// <inheritdoc/>
    public async Task<DraftDbPreview> PreviewAsync(DraftTarget target, IReadOnlyList<int> problemOrders)
    {
        // Read-only context; nothing here writes.
        await using var context = await dbContextFactory.CreateDbContextAsync();

        // Competition resolves by slug
        var competitionExists = await context.Competitions.AsNoTracking()
            .AnyAsync(competition => competition.Slug == target.CompetitionSlug);

        // Season resolves by start year
        var seasonExists = await context.Seasons.AsNoTracking()
            .AnyAsync(season => season.StartYear == target.SeasonYear);

        // Round resolves by composite slug.
        var compositeRoundSlug = TaxonomySlugs.ComposeRoundSlug(
            target.CompetitionSlug, target.CategorySlug, target.RoundSlug);
        var roundExists = await context.Rounds.AsNoTracking()
            .AnyAsync(round => round.CompositeSlug == compositeRoundSlug);

        // Order matters for the preview: competition, then season, then round.
        var resolutions = ImmutableArray.Create(
            new EntityResolution("competition", target.CompetitionSlug, ToAction(competitionExists)),
            new EntityResolution("season", target.SeasonYear.ToString(), ToAction(seasonExists)),
            new EntityResolution("round", compositeRoundSlug, ToAction(roundExists)));

        // Derive each problem's would-be slug...
        var candidateSlugs = problemOrders
            .Select(order => TaxonomySlugs.ProblemSlug(target.SeasonYear, compositeRoundSlug, order))
            .ToList();

        // ... report the ones already taken (importing would overwrite them).
        var collidingSlugs = await context.Problems.AsNoTracking()
            .Where(problem => candidateSlugs.Contains(problem.Slug))
            .Select(problem => problem.Slug)
            .ToListAsync();

        // Hand back the create-vs-reuse picture plus any collisions.
        return new DraftDbPreview(resolutions, [.. collidingSlugs]);
    }

    /// <summary>
    /// Maps an existence flag to its resolution action.
    /// </summary>
    /// <param name="exists">Whether the entity was found in the DB.</param>
    /// <returns>
    /// <see cref="ResolutionAction.Reuse"/> when present, <see cref="ResolutionAction.Create"/> when not.
    /// </returns>
    private static ResolutionAction ToAction(bool exists) =>
        exists ? ResolutionAction.Reuse : ResolutionAction.Create;
}

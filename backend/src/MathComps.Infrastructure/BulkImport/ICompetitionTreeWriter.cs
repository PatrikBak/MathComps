using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Persistence;

namespace MathComps.Infrastructure.BulkImport;

/// <summary>
/// Raises the archive's own rows for a competition path and a season, creating whatever the path names that is not
/// there yet. Everything that puts problems or competitions into the database goes through this, so a node is
/// numbered against the registry the same way, whoever raised it.
/// </summary>
public interface ICompetitionTreeWriter
{
    /// <summary>
    /// Raises every competition node on a path — the root, whatever sits between, and the node itself — each
    /// created if missing, and renumbers each generation it descends through to its registry positions first, so a
    /// mid-list insertion frees the slot the newcomer claims instead of colliding with a stored order. A node is
    /// born with its sort path already stamped: the walk runs root-down, so its parent's is known, and a row
    /// committed without one would be a node the readers throw on.
    /// </summary>
    /// <remarks>
    /// The rows land as the walk descends rather than all at the end, so a caller that needs the whole operation
    /// to be undoable holds a transaction around it.
    /// </remarks>
    /// <param name="context">The tracking write context.</param>
    /// <param name="path">The competition path to raise.</param>
    /// <returns>The node the path addresses, one resolution per node on it, and every node renumbered.</returns>
    /// <exception cref="InvalidOperationException">The registry cannot place a node on the path.</exception>
    Task<CompetitionNodeResolution> ResolveNodeAsync(MathCompsDbContext context, string path);

    /// <summary>
    /// Get-or-creates the season by start year, deriving a new row's <see cref="Season.EditionNumber"/> via
    /// <see cref="Season.EditionFromStartYear"/>.
    /// </summary>
    /// <param name="context">The tracking write context.</param>
    /// <param name="startYear">The season's start year.</param>
    /// <returns>The entity and whether it was reused or created.</returns>
    Task<SeasonResolution> GetOrCreateSeasonAsync(MathCompsDbContext context, int startYear);
}

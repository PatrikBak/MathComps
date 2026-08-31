using System.Collections.Immutable;
using MathComps.Domain.EfCoreEntities;

namespace MathComps.Infrastructure.BulkImport;

/// <summary>
/// What raising a competition path did: the node the path addresses, and what the walk down to it touched.
/// </summary>
/// <param name="Node">The node the path addresses.</param>
/// <param name="Chain">One resolution per node on the path, root-first.</param>
/// <param name="Changes">Every node the walk renumbered to match the registry.</param>
public record CompetitionNodeResolution(
    Competition Node,
    ImmutableArray<EntityResolution> Chain,
    ImmutableArray<SortOrderChange> Changes);

/// <summary>
/// What raising a season did: the row, and whether it was already there.
/// </summary>
/// <param name="Entity">The season.</param>
/// <param name="Action">Whether it was reused or created.</param>
public record SeasonResolution(Season Entity, ResolutionAction Action);

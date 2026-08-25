using MathComps.Domain.Contracts.Competitions;

namespace MathComps.Domain.Taxonomy;

/// <summary>
/// Where the site's own competitions sit in the taxonomy. They are ordinary competition nodes with ordinary
/// rounds and problems, so the only thing that needs naming is which node is which.
/// </summary>
public static class HostedTaxonomy
{
    /// <summary>
    /// The root node every hosted competition hangs off.
    /// </summary>
    /// <remarks>
    /// Below it sits one node per category, and below each of those one node per group the site runs. A group
    /// node is shared across every season it runs in, so its registered name has to be season-independent:
    /// <c>3. súťaž</c>, never <c>October 2026</c>. Which year a group ran in is its round's season, and a name
    /// carrying a year would be wrong for every season but the first.
    /// </remarks>
    public const string RootSlug = "mc";

    /// <summary>
    /// The level each category node stands for, keyed by that node's slug. A node outside this map is outside
    /// the levels, which is what the practice one is.
    /// </summary>
    private static readonly Dictionary<string, HostedCompetitionCategory> _categoriesBySlug = new()
    {
        ["elementary"] = HostedCompetitionCategory.Elementary,
        ["intermediate"] = HostedCompetitionCategory.Intermediate,
        ["advanced"] = HostedCompetitionCategory.Advanced,
    };

    /// <summary>
    /// Reads which level a hosted round runs at from the path of the node it hangs off.
    /// </summary>
    /// <param name="competitionPath">The node's path (e.g. <c>mc-advanced-3</c>).</param>
    /// <returns>The category, or null for a node that sits outside the levels.</returns>
    public static HostedCompetitionCategory? CategoryOf(string competitionPath)
    {
        // The category sits one below the root, so it is the second segment of the path.
        var segments = competitionPath.Split('-');

        // A path that never reaches a category names no level.
        return segments.Length >= 2 && _categoriesBySlug.TryGetValue(segments[1], out var category)
            ? category
            : null;
    }
}

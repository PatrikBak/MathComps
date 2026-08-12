using System.Collections.Immutable;

namespace MathComps.Domain.Taxonomy;

#region Building Blocks

/// <summary>
/// Display names (short and full) for localized metadata entities.
/// Used for every contest node, whatever depth it sits at.
/// </summary>
/// <param name="ShortName">Abbreviated name for compact displays (e.g., "MO" for "Matematická olympiáda").</param>
/// <param name="FullName">Complete official name for formal contexts.</param>
public record LocalizedNames(string ShortName, string FullName);

#endregion

#region Composite Types

/// <summary>
/// Localized display names for one locale, deserialized directly from a metadata.{locale}.json file: a name
/// for every contest node at any depth, plus the season-label template.
/// </summary>
/// <param name="Nodes">Localized names of every contest node, keyed by its path
/// (e.g. "csmo", "csmo-a", "csmo-a-iii").</param>
/// <param name="SeasonFormat">Template for season labels with {number}, {start}, {end} placeholders.</param>
public record PerLocaleMetadata(
    ImmutableDictionary<string, LocalizedNames> Nodes,
    string SeasonFormat)
{
    /// <summary>
    /// Gets the formatted season label by replacing placeholders in the season format template.
    /// </summary>
    /// <param name="editionNumber">The edition/year number of the competition.</param>
    /// <param name="startYear">The calendar year when the season started.</param>
    /// <param name="endYear">The calendar year when the season ended.</param>
    /// <returns>Formatted season label.</returns>
    public string GetSeasonLabel(int editionNumber, int startYear, int endYear) =>
        SeasonFormat
            .Replace("{number}", editionNumber.ToString())
            .Replace("{start}", startYear.ToString())
            .Replace("{end}", endYear.ToString());

    /// <summary>
    /// Gets the names (short and full) of the contest node a path addresses, whatever depth it sits at.
    /// </summary>
    /// <param name="path">The node's path (e.g. "csmo", "csmo-a", "csmo-a-iii", "memo-i").</param>
    /// <returns>Localized node names, or null if not found.</returns>
    public LocalizedNames? GetNodeNames(string path) =>
        // One map at any depth, a competition's own path included.
        Nodes.GetValueOrDefault(path);
}

#endregion

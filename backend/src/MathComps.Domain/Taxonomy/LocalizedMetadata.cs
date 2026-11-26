using System.Collections.Immutable;

namespace MathComps.Domain.Taxonomy;

#region Building Blocks

/// <summary>
/// What one locale says about a competition node: what it is shown as, short and full, what it is addressed by in a
/// URL, and what it is. Carried by every node, whatever depth it sits at.
/// </summary>
/// <param name="ShortName">Abbreviated name for compact displays (e.g., "MO" for "Matematická olympiáda").</param>
/// <param name="FullName">Complete official name for formal contexts.</param>
/// <param name="UrlSlug">
/// What the node is called in a URL, in this locale, ASCII and lowercase (e.g. <c>pokrocila-september</c>). Carried
/// only by the nodes the site addresses by name, which are the rounds it hosts itself.</param>
/// <param name="Description">
/// What the competition is, in a sentence or two. Carried only by a contest the site hosts in its own right, whose
/// name alone does not say what it is for.
/// </param>
public record LocalizedNode(string ShortName, string FullName, string? UrlSlug = null, string? Description = null);

#endregion

#region Composite Types

/// <summary>
/// Localized display names for one locale, deserialized directly from a metadata.{locale}.json file: a name
/// for every competition node at any depth, plus the season-label template.
/// </summary>
/// <param name="Nodes">What the locale says about every competition node, keyed by its path
/// (e.g. "csmo", "csmo-a", "csmo-a-iii").</param>
/// <param name="SeasonFormat">Template for season labels with {number}, {start}, {end} placeholders.</param>
public record PerLocaleMetadata(
    ImmutableDictionary<string, LocalizedNode> Nodes,
    string SeasonFormat)
{
    /// <summary>
    /// Gets the formatted season label by replacing placeholders in the season format template. A season runs
    /// across two calendar years, so the one it ends in follows from the one it started in.
    /// </summary>
    /// <param name="editionNumber">The edition/year number of the competition.</param>
    /// <param name="startYear">The calendar year when the season started.</param>
    /// <returns>Formatted season label.</returns>
    public string GetSeasonLabel(int editionNumber, int startYear) =>
        SeasonFormat
            .Replace("{number}", editionNumber.ToString())
            .Replace("{start}", startYear.ToString())
            .Replace("{end}", (startYear + 1).ToString());

    /// <summary>
    /// Gets what the locale says about the competition node a path addresses, whatever depth it sits at.
    /// </summary>
    /// <param name="path">The node's path (e.g. "csmo", "csmo-a", "csmo-a-iii", "memo-i").</param>
    /// <returns>The localized node, or null if not found.</returns>
    public LocalizedNode? GetNode(string path) =>
        // One map at any depth, a competition's own path included.
        Nodes.GetValueOrDefault(path);
}

#endregion

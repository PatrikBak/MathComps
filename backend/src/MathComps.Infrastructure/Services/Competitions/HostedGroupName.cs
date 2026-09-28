using MathComps.Domain.EfCoreEntities;
using MathComps.Domain.Localization;
using MathComps.Infrastructure.Services.Localization;

namespace MathComps.Infrastructure.Services.Competitions;

/// <summary>
/// What a hosted group is called. It carries no name of its own (<see cref="HostedGroup"/>), and every round of it
/// runs under a node of the same name, so its first round names it.
/// </summary>
public static class HostedGroupName
{
    /// <summary>
    /// Reads a group's name in every language the site is read in.
    /// </summary>
    /// <param name="localization">The names the taxonomy gives its nodes.</param>
    /// <param name="firstRoundPath">
    /// The path of the node the group's first round runs under, or null when it runs no rounds.
    /// </param>
    /// <returns>The name in each language, blank throughout for a group with no round to take it from.</returns>
    public static IReadOnlyDictionary<Language, string> Of(
        IMetadataLocalizationService localization, string? firstRoundPath) =>
        Enum.GetValues<Language>().ToDictionary(
            language => language,
            // A group with no rounds has no node to take a name from.
            language => firstRoundPath is null
                ? string.Empty
                : localization.GetNodeShortName(language, firstRoundPath));
}

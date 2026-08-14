
using MathComps.Domain.EfCoreEntities;
using MathComps.Domain.Taxonomy;
using MathComps.Domain.Localization;
namespace MathComps.Infrastructure.Services.Localization;

/// <summary>
/// Service for resolving localized display names for metadata entities.
/// </summary>
public interface IMetadataLocalizationService
{
    /// <summary>
    /// The language-neutral taxonomy structure: the tree of competition nodes and the sort order of each
    /// generation.
    /// </summary>
    SharedMetadata Shared { get; }

    /// <summary>
    /// Checks that a draft's contest is somewhere problems can land: every competition its path runs through
    /// must carry a structural entry in the shared taxonomy and a localized name in every locale, and the
    /// contest itself must run as a sitting rather than carry a generation below it. Returns one
    /// <see cref="TaxonomyRegistryIssue"/> per competition with a gap, so a typo'd or unregistered path is
    /// caught up front rather than slipping through as a missing name; an empty list means it all resolves.
    /// </summary>
    /// <param name="contestPath"><inheritdoc cref="Competition.Path" path="/summary"/></param>
    /// <returns>The registry-link issues found, or an empty list when everything resolves.</returns>
    IReadOnlyList<TaxonomyRegistryIssue> ValidateTaxonomyRegistration(string contestPath);

    /// <summary>
    /// Gets the localized short name of the contest node a path addresses, at whatever depth it sits — a whole
    /// competition, a category within one, or a round.
    /// </summary>
    /// <param name="lang">The language to get the name for.</param>
    /// <param name="path">The node's path (e.g., "imo", "csmo-a", "csmo-a-iii").</param>
    /// <returns>The localized short name.</returns>
    /// <exception cref="InvalidOperationException">Thrown if the node is not found.</exception>
    string GetNodeShortName(Language lang, string path);

    /// <summary>
    /// Gets the localized full name of the contest node a path addresses.
    /// </summary>
    /// <param name="lang">The language to get the name for.</param>
    /// <param name="path">The node's path (e.g., "imo", "csmo-a", "csmo-a-iii").</param>
    /// <returns>The localized full name.</returns>
    /// <exception cref="InvalidOperationException">Thrown if the node is not found.</exception>
    string GetNodeFullName(Language lang, string path);

    /// <summary>
    /// Gets the localized name for a tag.
    /// </summary>
    /// <param name="lang">The language to get the name for.</param>
    /// <param name="slug">The tag slug (e.g., "kombinatorika", "geometria").</param>
    /// <returns>The localized tag name.</returns>
    /// <exception cref="InvalidOperationException">Thrown if the tag is not found.</exception>
    string GetTagName(Language lang, string slug);

    /// <summary>
    /// Gets a formatted season label.
    /// </summary>
    /// <param name="lang">The language to get the format for.</param>
    /// <param name="editionNumber">The edition/year number (e.g., 57).</param>
    /// <param name="startYear">The start year of the season (e.g., 2024).</param>
    /// <param name="endYear">The end year of the season (e.g., 2025).</param>
    /// <returns>A formatted season label (e.g., "57. ročník (2024/2025)").</returns>
    /// <exception cref="InvalidOperationException">Thrown if the season format is not found.</exception>
    string GetSeasonLabel(Language lang, int editionNumber, int startYear, int endYear);
}

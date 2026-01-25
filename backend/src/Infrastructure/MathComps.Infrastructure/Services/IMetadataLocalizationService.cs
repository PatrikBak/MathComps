namespace MathComps.Infrastructure.Services;

/// <summary>
/// Service for resolving localized display names for metadata entities.
/// </summary>
public interface IMetadataLocalizationService
{
    /// <summary>
    /// Gets the localized short name for a competition.
    /// </summary>
    /// <param name="lang">The language to get the name for.</param>
    /// <param name="slug">The competition slug (e.g., "csmo", "imo").</param>
    /// <returns>The localized short name.</returns>
    /// <exception cref="InvalidOperationException">Thrown if the competition is not found.</exception>
    string GetCompetitionShortName(Language lang, string slug);

    /// <summary>
    /// Gets the localized full name for a competition.
    /// </summary>
    /// <param name="lang">The language to get the name for.</param>
    /// <param name="slug">The competition slug (e.g., "csmo", "imo").</param>
    /// <returns>The localized full name.</returns>
    /// <exception cref="InvalidOperationException">Thrown if the competition is not found.</exception>
    string GetCompetitionFullName(Language lang, string slug);

    /// <summary>
    /// Gets the localized short name for a round.
    /// Round names are context-dependent based on competition and category.
    /// </summary>
    /// <param name="lang">The language to get the name for.</param>
    /// <param name="competitionSlug">The competition slug (e.g., "csmo").</param>
    /// <param name="categorySlug">The category slug (e.g., "a", "z5"), or null if for rounds with no category.</param>
    /// <param name="roundSlug">The round slug (e.g., "i", "ii", "iii").</param>
    /// <returns>The localized round short name.</returns>
    /// <exception cref="InvalidOperationException">Thrown if the round is not found.</exception>
    string GetRoundShortName(Language lang, string competitionSlug, string? categorySlug, string? roundSlug);

    /// <summary>
    /// Gets the localized full name for a round.
    /// Round names are context-dependent based on competition and category.
    /// </summary>
    /// <param name="lang">The language to get the name for.</param>
    /// <param name="competitionSlug">The competition slug (e.g., "csmo").</param>
    /// <param name="categorySlug">The category slug (e.g., "a", "z5"), or null if not applicable.</param>
    /// <param name="roundSlug">The round slug (e.g., "i", "ii", "iii"), or null for default/only round.</param>
    /// <returns>The localized round full name.</returns>
    /// <exception cref="InvalidOperationException">Thrown if the round is not found.</exception>
    string GetRoundFullName(Language lang, string competitionSlug, string? categorySlug, string? roundSlug);

    /// <summary>
    /// Gets the localized name for a category.
    /// </summary>
    /// <param name="lang">The language to get the name for.</param>
    /// <param name="slug">The category slug (e.g., "a", "b", "z5").</param>
    /// <returns>The localized category name.</returns>
    /// <exception cref="InvalidOperationException">Thrown if the category is not found.</exception>
    string GetCategoryName(Language lang, string slug);

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

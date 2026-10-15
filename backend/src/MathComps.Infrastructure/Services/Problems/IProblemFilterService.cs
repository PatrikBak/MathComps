using MathComps.Domain.Contracts.ProblemQuery;
using MathComps.Domain.Contracts.SearchBar;
using MathComps.Domain.Localization;
using MathComps.Infrastructure.Services.Users;

namespace MathComps.Infrastructure.Services.Problems;

/// <summary>
/// Contract for filtering competition problems for the library view.
/// The initial library state is configured via application configuration and not provided by this service.
/// </summary>
public interface IProblemFilterService
{
    /// <summary>
    /// Applies a <see cref="ProblemFilterOptions"/> to retrieve a page of problems and, when applicable,
    /// refreshed facet options with counts for the search bar.
    /// </summary>
    /// <param name="options">Complete options containing selected filters, sort, paging, and user context.</param>
    /// <returns>
    /// Filtered page of problems, optionally updated facet options, and the name of the list the query narrows to.
    /// </returns>
    /// <exception cref="ListNotFoundException">The query narrows to a list that does not exist.</exception>
    /// <exception cref="ListAccessDeniedException">The query narrows to someone else's list that is not shared.</exception>
    /// <exception cref="FavoritesRequireAuthenticationException">The query asks for favorites anonymously.</exception>
    /// <exception cref="MarkStatusRequiresAuthenticationException">The query asks for a mark status anonymously.</exception>
    Task<ProblemFilterResponse> FilterAsync(ProblemFilterOptions options);

    /// <summary>
    /// Gets all competitions grouped by season with problem counts for the competition browser.
    /// </summary>
    /// <param name="language">The language for localized display names.</param>
    /// <returns>Seasons with their available competitions and problem counts.</returns>
    Task<SeasonCompetitionBrowserResult> GetCompetitionsBySeasonAsync(Language language);
}

/// <summary>
/// Thrown when a favorites-only filter is requested without an authenticated user.
/// </summary>
public sealed class FavoritesRequireAuthenticationException() : Exception("Cannot filter favorites without an authenticated user");

/// <summary>
/// Thrown when a mark-status filter is requested without an authenticated user.
/// </summary>
public sealed class MarkStatusRequiresAuthenticationException() : Exception("Cannot filter by mark status without an authenticated user");



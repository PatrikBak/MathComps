using MathComps.Domain.ApiDtos.ProblemQuery;
using MathComps.Domain.ApiDtos.SearchBar;

namespace MathComps.Infrastructure.Services;

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
    /// <returns>Filtered page of problems and optionally updated facet options.</returns>
    Task<FilterResult> FilterAsync(ProblemFilterOptions options);

    /// <summary>
    /// Gets all contests grouped by season with problem counts for the contest browser.
    /// </summary>
    /// <returns>Seasons with their available contests and problem counts.</returns>
    Task<SeasonContestBrowserResult> GetContestsBySeasonAsync();
}


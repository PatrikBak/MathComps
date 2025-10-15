using MathComps.Domain.ApiDtos.ProblemQuery;

namespace MathComps.Infrastructure.Services;

/// <summary>
/// Contract for filtering competition problems for the library view.
/// The initial library state is configured via application configuration and not provided by this service.
/// </summary>
public interface IProblemFilterService
{
    /// <summary>
    /// Applies a <see cref="FilterQuery"/> to retrieve a page of problems and, when applicable,
    /// refreshed facet options with counts for the search bar.
    /// </summary>
    /// <param name="query">Complete query containing selected filters, sort, and paging.</param>
    /// <returns>Filtered page of problems and optionally updated facet options.</returns>
    Task<FilterResult> FilterAsync(FilterQuery query);
}


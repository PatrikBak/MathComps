using MathComps.Domain.ApiDtos.Helpers;
using MathComps.Domain.ApiDtos.SearchBar;

namespace MathComps.Domain.ApiDtos.ProblemQuery;

/// <summary>
/// Result of a filtering operation over problems.
/// </summary>
/// <param name="Problems">Paged results matching the query.</param>
/// <param name="UpdatedOptions">When present, refreshed facet options with counts; omitted on subsequent pages.</param>
public record FilterResult(
    PagedList<ProblemDto> Problems,
    SearchBarOptions? UpdatedOptions
);

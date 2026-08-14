using MathComps.Domain.Contracts.Helpers;
using MathComps.Domain.Contracts.SearchBar;

namespace MathComps.Domain.Contracts.ProblemQuery;

/// <summary>
/// Result of a filtering operation over problems.
/// </summary>
/// <param name="Problems">Paged results matching the query.</param>
/// <param name="BaseOptions">
/// Every option the library offers, counted across the whole library rather than across what the query
/// narrows to. Present when the caller asked for it and this is the first page.
/// </param>
/// <param name="UpdatedOptions">
/// The options of <paramref name="BaseOptions"/>, counted across what the query narrows to instead.
/// Present on the first page of a query that narrows anything; a query that narrows nothing is already
/// answered by the counts across the whole library.
/// </param>
public record FilterResult(
    PagedList<ProblemDto> Problems,
    SearchBarOptions? BaseOptions,
    SearchBarOptions? UpdatedOptions
);

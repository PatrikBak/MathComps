namespace MathComps.Domain.Contracts.ProblemQuery;

/// <summary>
/// API response for the single-problem endpoint. Wraps the <see cref="FilterResult"/> holding that one
/// problem with the filters it was fetched under, which pin down that problem and nothing else.
/// </summary>
/// <param name="FilterResult">The page holding the one problem the slug named, and its facet options.</param>
/// <param name="Filters">Where the problem sits, which is what the page was fetched under.</param>
public record SingleProblemResponse(
    FilterResult FilterResult,
    ProblemLookupResult Filters
);

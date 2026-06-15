namespace MathComps.Domain.Contracts.ProblemQuery;

/// <summary>
/// API response for the problem filter endpoint.
/// Wraps the service-level <see cref="FilterResult"/> with API-only metadata.
/// </summary>
/// <param name="FilterResult">The service-level filter result containing problems and facet options.</param>
/// <param name="ListName">When filtering by a list, the display name of that list. Null otherwise.</param>
public record ProblemFilterResponse(
    FilterResult FilterResult,
    string? ListName = null
);

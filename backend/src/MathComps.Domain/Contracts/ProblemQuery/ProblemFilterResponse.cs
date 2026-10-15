namespace MathComps.Domain.Contracts.ProblemQuery;

/// <summary>
/// One filtering run's answer: the <see cref="FilterResult"/> it found, and the name of any list it narrowed to.
/// </summary>
/// <param name="FilterResult">The page of problems and its facet options.</param>
/// <param name="ListName">When filtering by a list, the display name of that list. Null otherwise.</param>
public record ProblemFilterResponse(
    FilterResult FilterResult,
    string? ListName = null
);

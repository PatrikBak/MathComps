namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// Extension methods for <see cref="IQueryable{T}"/> of <see cref="Problem"/>.
/// </summary>
public static class ProblemQueryableExtensions
{
    /// <summary>
    /// Applies the default sorting for problems: newest seasons first, then chronologically by event date,
    /// then down the contest tree, and finally problem number.
    /// </summary>
    /// <param name="source">The source queryable of problems.</param>
    /// <returns>The queryable with default sorting applied.</returns>
    public static IQueryable<Problem> OrderByDefaultProblemSort(this IQueryable<Problem> source) => source
        // Newest seasons first
        .OrderByDescending(problem => problem.Round.Season.StartYear)
        // Chronologically within season: newest events first
        .ThenByDescending(problem => problem.Round.Date)
        // For contests sharing a date (e.g. the home rounds), the tree's own order decides, at any depth
        .ThenBy(problem => problem.Round.Competition.SortPath)
        // Problem number within the contest
        .ThenBy(problem => problem.Number);
}



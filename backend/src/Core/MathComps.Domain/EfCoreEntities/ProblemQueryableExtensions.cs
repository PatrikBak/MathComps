namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// Extension methods for <see cref="IQueryable{T}"/> of <see cref="Problem"/>.
/// </summary>
public static class ProblemQueryableExtensions
{
    /// <summary>
    /// Applies the default sorting for problems: newest seasons first, then competition, round, category, and problem number.
    /// </summary>
    /// <param name="source">The source queryable of problems.</param>
    /// <returns>The queryable with default sorting applied.</returns>
    public static IQueryable<Problem> OrderByDefaultProblemSort(this IQueryable<Problem> source) => source
        // Newest seasons first
        .OrderByDescending(problem => problem.RoundInstance.Season.StartYear)
        // Then by competition, round, category, and problem number
        .ThenBy(problem => problem.RoundInstance.Round.Competition.SortOrder)
        .ThenBy(problem => problem.RoundInstance.Round.SortOrder)
        .ThenBy(problem => problem.RoundInstance.Round.Category != null ? problem.RoundInstance.Round.Category.SortOrder : 0)
        .ThenBy(problem => problem.Number);
}



namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// Extension methods for <see cref="IQueryable{T}"/> of <see cref="Problem"/>.
/// </summary>
public static class ProblemQueryableExtensions
{
    /// <summary>
    /// Applies the default sorting for problems: newest seasons first, then 
    /// chronologically by event date, then by category (if any, otherwise by 
    /// competition), and problem number.
    /// </summary>
    /// <param name="source">The source queryable of problems.</param>
    /// <returns>The queryable with default sorting applied.</returns>
    public static IQueryable<Problem> OrderByDefaultProblemSort(this IQueryable<Problem> source) => source
        // Newest seasons first
        .OrderByDescending(problem => problem.RoundInstance.Season.StartYear)
        // Chronologically within season: newest events first
        .ThenByDescending(problem => problem.RoundInstance.Date)
        // For same-date rounds (e.g., home rounds), higher categories get priority
        .ThenBy(problem => problem.RoundInstance.Round.Category != null
            ? problem.RoundInstance.Round.Category.SortOrder
            // And when there is no category, just take the competition sort order
            : problem.RoundInstance.Round.Competition.SortOrder)
        // Problem number within the round
        .ThenBy(problem => problem.Number);
}



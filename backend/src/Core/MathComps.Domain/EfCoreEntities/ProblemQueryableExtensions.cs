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
    public static IQueryable<Problem> OrderByDefaultProblemSort(this IQueryable<Problem> source)
    {
        return source
            .OrderByDescending(p => p.RoundInstance.Season.StartYear)
            .ThenBy(p => p.RoundInstance.Round.Competition.SortOrder)
            .ThenBy(p => p.RoundInstance.Round.SortOrder)
            .ThenBy(p => p.RoundInstance.Round.Category != null ? p.RoundInstance.Round.Category.SortOrder : 0)
            .ThenBy(p => p.Number);
    }
}



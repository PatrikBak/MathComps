namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// Extension methods for <see cref="IQueryable{T}"/> of <see cref="Problem"/>.
/// </summary>
public static class ProblemQueryableExtensions
{
    /// <summary>
    /// Applies the default sorting for problems: newest seasons first, then chronologically by event date,
    /// then down the competition tree, and finally problem number.
    /// </summary>
    /// <param name="source">The source queryable of problems.</param>
    /// <returns>The queryable with default sorting applied.</returns>
    public static IQueryable<Problem> OrderByDefaultProblemSort(this IQueryable<Problem> source) => source
        // Newest seasons first
        .OrderByDescending(problem => problem.Round.Season.StartYear)
        // Chronologically within season: newest events first
        .ThenByDescending(problem => problem.Round.Date)
        // For competitions sharing a date (e.g. the home rounds), the tree's own order decides, at any depth
        .ThenBy(problem => problem.Round.Competition.SortPath)
        // Problem number within the competition
        .ThenBy(problem => problem.Number);

    /// <summary>
    /// Narrows to the problems the archive may serve: the ones whose round has opened. An unstamped round is open,
    /// and a stamped one opens the instant its <see cref="Round.VisibleSince"/> passes, so this comparison is the
    /// whole of what an embargo is. There is no state to flip.
    /// </summary>
    /// <remarks>
    /// The instant is a parameter rather than a clock read inside, so one caller can judge every query it runs at
    /// the same "now".
    /// </remarks>
    /// <param name="source">The source queryable of problems.</param>
    /// <param name="asOf">The instant to judge each round's visibility at.</param>
    /// <returns>The queryable narrowed to problems of rounds open at that instant.</returns>
    public static IQueryable<Problem> WhereRoundHasOpened(this IQueryable<Problem> source, DateTimeOffset asOf) =>
        source.Where(problem =>
            problem.Round.VisibleSince == null || problem.Round.VisibleSince <= asOf);
}



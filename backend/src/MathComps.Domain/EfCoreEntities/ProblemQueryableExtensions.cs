using System.Linq.Expressions;
using MathComps.Domain.Taxonomy;

namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// Extension methods for <see cref="IQueryable{T}"/> of <see cref="Problem"/>.
/// </summary>
public static class ProblemQueryableExtensions
{
    /// <summary>
    /// Whether a problem's round hangs outside the proposals branch. The form of
    /// <see cref="TaxonomySlugs.IsAtOrUnder"/> a query can run, negated, for that one branch.
    /// </summary>
    private static readonly Expression<Func<Problem, bool>> _isOutsideProposals = problem =>
        problem.Round.Competition.Path != HostedTaxonomy.ProposalsPath
        && !problem.Round.Competition.Path.StartsWith(HostedTaxonomy.ProposalsPath + "-");

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
    /// Narrows to the problems the archive may serve: those of rounds that have opened, that the site did not host,
    /// and that sit outside the proposals. An unstamped round is open, and a stamped one opens the instant its
    /// <see cref="Round.VisibleSince"/> passes, so that comparison is the whole of what an embargo is. There is no
    /// state to flip. A round the site hosted stays out even once open, as it is read as a competition, and a
    /// proposal stays out whatever its round's stamp says, being unused competition material.
    /// </summary>
    /// <remarks>
    /// The instant is a parameter rather than a clock read inside, so one caller can judge every query it runs at
    /// the same "now".
    /// </remarks>
    /// <param name="source">The source queryable of problems.</param>
    /// <param name="asOf">The instant to judge each round's visibility at.</param>
    /// <returns>The queryable narrowed to the problems the archive may serve at that instant.</returns>
    public static IQueryable<Problem> WhereArchiveServes(this IQueryable<Problem> source, DateTimeOffset asOf) => source
        // Rounds that have opened and that the site did not host
        .Where(problem =>
            problem.Round.HostedGroupId == null
            && (problem.Round.VisibleSince == null || problem.Round.VisibleSince <= asOf))
        // And nothing parked among the proposals
        .Where(_isOutsideProposals);
}



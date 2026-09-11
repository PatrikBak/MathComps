using MathComps.Domain.EfCoreEntities;
using MathComps.Domain.Taxonomy;
using MathComps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace MathComps.Infrastructure.BulkImport;

/// <summary>
/// EF Core implementation of <see cref="IProblemSwapService"/>. Spins up one tracking
/// <see cref="MathCompsDbContext"/>, reads both problems with the round, competition and season their slugs are
/// derived from, and performs the exchange under a transaction so a failure part-way cannot leave one problem
/// parked out of position.
/// </summary>
/// <param name="dbContextFactory">Factory for the tracking write context.</param>
public class ProblemSwapService(IDbContextFactory<MathCompsDbContext> dbContextFactory) : IProblemSwapService
{
    /// <summary>
    /// The number a problem is parked on while the other one claims the slot it vacated. The unique index over
    /// (round, number) is not deferrable, so the two rows cannot trade numbers directly; the park is a slot no real
    /// paper reaches, and it satisfies the positive-number check the column carries.
    /// </summary>
    private const int ParkingNumber = int.MaxValue;

    /// <inheritdoc/>
    public async Task<ProblemSwapResult> SwapAsync(string slugA, string slugB, bool dryRun = false)
    {
        // Naming one problem twice asks for an exchange with itself, which no writing could carry out.
        if (slugA == slugB)
            throw new ProblemSwapRefusedException(
                $"'{slugA}' is both halves of the exchange, so there is nothing to exchange it with.");

        // One tracking context for the whole exchange.
        await using var context = await dbContextFactory.CreateDbContextAsync();

        // Both problems, each with the round, competition and season its slug is derived from.
        var first = await LoadProblemAsync(context, slugA);
        var second = await LoadProblemAsync(context, slugB);

        // The slug each one takes on at the position it lands on, keyed by the destination round's competition and
        // season and by the number it inherits there.
        var firstNewSlug = SlugFor(second.Round, second.Number);
        var secondNewSlug = SlugFor(first.Round, first.Number);

        // Nothing enforces slug uniqueness in the schema, while the import resolves a draft to a single problem by
        // slug — so a third problem already holding one of these would not fail here, it would fail the next import.
        await RefuseSlugCollisionAsync(context, firstNewSlug, first.Id, second.Id);
        await RefuseSlugCollisionAsync(context, secondNewSlug, first.Id, second.Id);

        // Where both problems stand, read before anything moves them.
        var result = new ProblemSwapResult(
            await DescribeAsync(context, first),
            await DescribeAsync(context, second),
            firstNewSlug,
            secondNewSlug);

        // A dry run has now run every refusal and worked out the whole answer, which is all it promises to do.
        if (dryRun)
            return result;

        // Perform the exchange.
        await ExchangeAsync(context, first, second, firstNewSlug, secondNewSlug);

        // What the exchange did.
        return result;
    }

    /// <summary>
    /// Reads the problem a slug names, together with the round, competition and season the destination slug is
    /// derived from.
    /// </summary>
    /// <param name="context">The tracking write context.</param>
    /// <param name="slug">The slug naming the problem.</param>
    /// <returns>The problem, tracked.</returns>
    /// <exception cref="ProblemSwapRefusedException">Thrown when the slug does not name exactly one problem.</exception>
    private static async Task<Problem> LoadProblemAsync(MathCompsDbContext context, string slug)
    {
        // The problems answering to the slug, with the chain each one's slug is built from. Two is a state the
        // schema permits, and a third is of no further interest once the second has settled the answer.
        var candidates = await context.Problems
            .Include(candidate => candidate.Round).ThenInclude(round => round.Competition)
            .Include(candidate => candidate.Round).ThenInclude(round => round.Season)
            .Where(candidate => candidate.Slug == slug)
            .Take(2)
            .ToListAsync();

        // A slug naming nothing is the caller's to fix.
        if (candidates.Count == 0)
            throw new ProblemSwapRefusedException($"No problem carries the slug '{slug}'.");

        // A slug two problems answer to names neither of them.
        if (candidates.Count > 1)
            throw new ProblemSwapRefusedException(
                $"More than one problem carries the slug '{slug}', so it does not say which one to move.");

        // The problem to move.
        return candidates[0];
    }

    /// <summary>
    /// Refuses a slug that a problem outside the exchange already carries. The import resolves a draft to one
    /// problem by slug, so a second row holding it turns the next import of either problem into a failure whose
    /// cause sits nowhere near the draft being imported.
    /// </summary>
    /// <param name="context">The tracking write context.</param>
    /// <param name="slug">The slug the exchange would write.</param>
    /// <param name="firstId">The id of the first problem in the exchange, which may hold the slug today.</param>
    /// <param name="secondId">The id of the second problem in the exchange, which may hold the slug today.</param>
    /// <returns>A task representing the check.</returns>
    /// <exception cref="ProblemSwapRefusedException">Thrown when a third problem already carries the slug.</exception>
    private static async Task RefuseSlugCollisionAsync(
        MathCompsDbContext context, string slug, Guid firstId, Guid secondId)
    {
        // Whether a problem outside this exchange already answers to the slug.
        var taken = await context.Problems.AnyAsync(candidate =>
            candidate.Slug == slug && candidate.Id != firstId && candidate.Id != secondId);

        // Writing it would leave two problems answering to one slug, which the next import of either would hit.
        if (taken)
            throw new ProblemSwapRefusedException(
                $"The slug '{slug}' is already carried by another problem, so the exchange would leave two "
                + "problems answering to it.");
    }

    /// <summary>
    /// Reads where a problem stands and how much of a student's work hangs off it.
    /// </summary>
    /// <param name="context">The tracking write context.</param>
    /// <param name="problem">The problem to describe.</param>
    /// <returns>The problem's position and the weight of what points at it.</returns>
    private static async Task<ProblemSwapSide> DescribeAsync(MathCompsDbContext context, Problem problem)
    {
        // How many conversations were argued about it.
        var defenses = await context.ProblemDefenses.CountAsync(row => row.ProblemId == problem.Id);

        // How many comments were written on it.
        var comments = await context.ProblemComments.CountAsync(row => row.ProblemId == problem.Id);

        // How many students recorded how they did on it.
        var selfAssessments = await context.ProblemSelfAssessments.CountAsync(row => row.ProblemId == problem.Id);

        // Where it stands, and what travels with it.
        return new ProblemSwapSide(
            problem.Slug,
            problem.Round.Competition.Path,
            problem.Round.Season.StartYear,
            problem.Number,
            defenses,
            comments,
            selfAssessments);
    }

    /// <summary>
    /// Moves each problem onto the other's round and number, writing the slug that position calls for.
    /// </summary>
    /// <remarks>
    /// The unique index over (round, number) is checked per statement rather than at commit, so the two rows cannot
    /// trade numbers in one batch and EF does not order the updates within one anyway. The first problem is parked
    /// and flushed on its own, which frees its slot for the second, and the second is flushed before the first
    /// claims the slot it vacated. One transaction covers all three, so nothing can observe a parked row.
    /// </remarks>
    /// <param name="context">The tracking write context.</param>
    /// <param name="first">The first problem in the exchange.</param>
    /// <param name="second">The second problem in the exchange.</param>
    /// <param name="firstNewSlug">The slug the first problem takes on in the second's position.</param>
    /// <param name="secondNewSlug">The slug the second problem takes on in the first's position.</param>
    /// <returns>A task representing the exchange.</returns>
    private static async Task ExchangeAsync(
        MathCompsDbContext context,
        Problem first,
        Problem second,
        string firstNewSlug,
        string secondNewSlug)
    {
        // Where each one is headed, captured before either is moved off it.
        var (firstRoundId, firstNumber) = (first.RoundId, first.Number);
        var (secondRoundId, secondNumber) = (second.RoundId, second.Number);

        // The transaction the three writes land in.
        await using var transaction = await context.Database.BeginTransactionAsync();

        // Park the first problem, freeing the slot the second is about to claim.
        first.Number = ParkingNumber;
        await context.SaveChangesAsync();

        // Move the second onto the slot the first just vacated.
        second.RoundId = firstRoundId;
        second.Number = firstNumber;
        second.Slug = secondNewSlug;
        await context.SaveChangesAsync();

        // Move the first onto the slot the second vacated, off the parking number.
        first.RoundId = secondRoundId;
        first.Number = secondNumber;
        first.Slug = firstNewSlug;
        await context.SaveChangesAsync();

        // Commit the exchange.
        await transaction.CommitAsync();
    }

    /// <summary>
    /// Derives the slug a problem carries at a position, from the competition and season the round belongs to.
    /// </summary>
    /// <param name="round">The round the problem sits in, with its competition and season loaded.</param>
    /// <param name="number">The problem's position within that round.</param>
    /// <returns>The slug that position calls for.</returns>
    private static string SlugFor(Round round, int number) =>
        // The same formula the import builds a draft's slugs with, so a re-import of the rearranged paper matches.
        TaxonomySlugs.ProblemSlug(
            Season.EditionFromStartYear(round.Season.StartYear), round.Competition.Path, number);
}

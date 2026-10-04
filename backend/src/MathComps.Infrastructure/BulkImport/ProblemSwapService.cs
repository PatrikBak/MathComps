using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Competitions;
using MathComps.Infrastructure.Services.Problems;
using MathComps.Infrastructure.Services.Selection;
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
    /// <inheritdoc/>
    public async Task<ProblemSwapResult> SwapAsync(string slugA, string slugB, bool dryRun = false)
    {
        // Naming one problem twice asks for an exchange with itself, which no writing could carry out.
        if (slugA == slugB)
            throw new ProblemSwapRefusedException(
                $"'{slugA}' is both halves of the exchange, so there is nothing to exchange it with.");

        // One tracking context for the whole exchange.
        await using var context = await dbContextFactory.CreateDbContextAsync();

        // One transaction for the lock, the reads and the writes, so the lock spans them all and a failure part-way
        // cannot leave one problem parked.
        await using var transaction = await context.Database.BeginTransactionAsync();

        // Wait for every other move to finish, so nothing moves either problem between the reads below and the writes.
        await ProblemPositions.LockAsync(context, CancellationToken.None);

        // Both problems, each with the round, competition and season its slug is derived from.
        var first = await LoadProblemAsync(context, slugA);
        var second = await LoadProblemAsync(context, slugB);

        // Each problem with the round it lands in.
        (Problem Moving, Round Destination)[] moves = [(first, second.Round), (second, first.Round)];

        // Neither may land in a round it cannot stand in.
        foreach (var (moving, destination) in moves)
        {
            // A board's round takes only a proposal the selection still reads.
            await RefuseNonProposalInBoardRoundAsync(context, moving, destination);

            // A hosted round takes only a problem written in every language.
            await RefuseIncompleteInHostedRoundAsync(context, moving, destination);
        }

        // The slug each takes on where it lands, refused when a third problem already holds one.
        var exchange = await ProblemPositions.PlanExchangeAsync(context, first, second, CancellationToken.None);

        // Where both problems stand, read before anything moves them.
        var result = new ProblemSwapResult(
            await DescribeAsync(context, first),
            await DescribeAsync(context, second),
            exchange.FirstNewSlug,
            exchange.SecondNewSlug);

        // A dry run has now run every refusal and worked out the whole answer, which is all it promises to do.
        if (dryRun)
            return result;

        // The problems the exchange takes out of the pool, read while each still stands where it started.
        var leavingPool = moves
            .Where(move => SelectionRules.IsInPool(move.Moving.Round.Competition.Path)
                && !SelectionRules.IsInPool(move.Destination.Competition.Path))
            .Select(move => move.Moving.Id)
            .ToList();

        // Perform the exchange.
        await ProblemPositions.ExchangeAsync(context, first, second, exchange, CancellationToken.None);

        // A problem leaving the pool leaves every draft board it stood on.
        await SelectionRules.RemoveSlotsAsync(context, leavingPool, CancellationToken.None);

        // Save the emptied board slots.
        await context.SaveChangesAsync();

        // Commit the exchange.
        await transaction.CommitAsync();

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
    /// Refuses to move a problem into a round a selection board filled unless it is a proposal still in the
    /// selection. The selection reads that round's problems as its own, so anything else would stand in a slot as a
    /// problem it cannot show.
    /// </summary>
    /// <param name="context">The tracking write context.</param>
    /// <param name="moving">The problem being moved.</param>
    /// <param name="destination">The round it lands in.</param>
    /// <returns>A task that completes once the move has passed.</returns>
    /// <exception cref="ProblemSwapRefusedException">Thrown when the problem may not land there.</exception>
    private static async Task RefuseNonProposalInBoardRoundAsync(
        MathCompsDbContext context, Problem moving, Round destination)
    {
        // A problem staying in its round, or landing in one no group runs, changes nothing the selection reads.
        if (destination.Id == moving.RoundId || destination.HostedGroupId is not { } groupId)
            return;

        // Whether a board was finalized into the destination's group.
        var filledByBoard = await context.SelectionBoards.AnyAsync(board => board.HostedGroupId == groupId);

        // Whether the problem is a proposal the selection still reads.
        var isLiveProposal = await context.Proposals.AnyAsync(
            proposal => proposal.ProblemId == moving.Id && proposal.DeletedAt == null);

        // Only such a proposal may stand in a board's round.
        if (filledByBoard && !isLiveProposal)
            throw new ProblemSwapRefusedException(
                $"'{moving.Slug}' is not a proposal in the selection, and the round it would land in was filled by a "
                + "selection board, which holds proposals alone.");
    }

    /// <summary>
    /// Refuses to move a problem missing a statement or a solution in some language into a hosted round, which
    /// <see cref="HostedProblemTexts"/> says no hosted round can carry.
    /// </summary>
    /// <param name="context">The tracking write context.</param>
    /// <param name="moving">The problem being moved.</param>
    /// <param name="destination">The round it lands in.</param>
    /// <returns>A task that completes once the move has passed.</returns>
    /// <exception cref="ProblemSwapRefusedException">Thrown when the problem may not land there.</exception>
    private static async Task RefuseIncompleteInHostedRoundAsync(
        MathCompsDbContext context, Problem moving, Round destination)
    {
        // A problem staying in its round, or landing in one no group runs, reaches no reader it did not already.
        if (destination.Id == moving.RoundId || destination.HostedGroupId is null)
            return;

        // Whether the moving problem lacks a statement or a solution in some language.
        var isIncomplete = await context.Problems
            .Where(problem => problem.Id == moving.Id)
            .AnyAsync(HostedProblemTexts.IsIncomplete);

        // A hosted round can't carry such a problem.
        if (isIncomplete)
            throw new ProblemSwapRefusedException(
                $"'{moving.Slug}' lacks a statement or a solution in some language, and the round it would land in "
                + "is hosted, so it would serve that language a blank.");
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
}

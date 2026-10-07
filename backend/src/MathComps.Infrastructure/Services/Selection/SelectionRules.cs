using MathComps.Domain.EfCoreEntities;
using MathComps.Domain.Taxonomy;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Problems;
using Microsoft.EntityFrameworkCore;

namespace MathComps.Infrastructure.Services.Selection;

/// <summary>
/// The rules every part of the problem selection shares: writes run one at a time, and the read and the writes
/// agree on which problems are still in the pool and which groups still take a board.
/// </summary>
internal static class SelectionRules
{
    /// <summary>
    /// Runs one write in its own transaction, after every write before it has committed, a selection write or any
    /// other move of a problem. The write reads what it checks only once it holds the lock, so it never acts on a
    /// state another write has since changed.
    /// </summary>
    /// <param name="dbContextFactory">Creates the context the write runs on.</param>
    /// <param name="write">The write, handed the context; whatever it leaves tracked is saved.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>A task that completes once the write has committed.</returns>
    public static async Task RunWriteAsync(
        IDbContextFactory<MathCompsDbContext> dbContextFactory,
        Func<MathCompsDbContext, Task> write,
        CancellationToken cancellationToken)
    {
        // A fresh context for this write.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // One transaction for the reads and the writes, so the lock below spans both.
        await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);

        // Wait for every other write to finish.
        await ProblemPositions.LockAsync(dbContext, cancellationToken);

        // The write itself.
        await write(dbContext);

        // Save the write's changes.
        await dbContext.SaveChangesAsync(cancellationToken);

        // And commit the write.
        await transaction.CommitAsync(cancellationToken);
    }

    /// <summary>
    /// Reads a proposal that has not been deleted, tracked, with its problem, the problem's round, and that round's
    /// competition and season.
    /// </summary>
    /// <param name="dbContext">The write's context.</param>
    /// <param name="proposalId">The proposal, which is its problem's id.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>The proposal.</returns>
    /// <exception cref="SelectionTargetNotFoundException">Thrown when no live proposal has the id.</exception>
    public static async Task<Proposal> ReadProposalAsync(
        MathCompsDbContext dbContext, Guid proposalId, CancellationToken cancellationToken) =>
        // The proposal, refused like one that is not there once it has been deleted
        await dbContext.Proposals
            .Include(proposal => proposal.Problem.Round.Competition)
            .Include(proposal => proposal.Problem.Round.Season)
            .Where(proposal => proposal.ProblemId == proposalId && proposal.DeletedAt == null)
            .FirstOrDefaultAsync(cancellationToken)
        ?? throw new SelectionTargetNotFoundException();

    /// <summary>
    /// Empties every slot the problems stand in, which only a draft paper keeps.
    /// </summary>
    /// <param name="dbContext">The write's context.</param>
    /// <param name="problemIds">The problems leaving the drafts.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>A task that completes once the slots are marked for removal.</returns>
    public static async Task RemoveSlotsAsync(
        MathCompsDbContext dbContext, IReadOnlyCollection<Guid> problemIds, CancellationToken cancellationToken)
    {
        // Every slot one of the problems stands in
        var slots = await dbContext.SelectionSlots
            .Where(slot => problemIds.Contains(slot.ProblemId))
            .ToListAsync(cancellationToken);

        // Emptied when the write saves
        dbContext.SelectionSlots.RemoveRange(slots);
    }

    /// <summary>
    /// Whether a problem is still in the pool, which it is while it sits in a round of the
    /// <see cref="HostedTaxonomy.ProposalsPath"/> branch. A problem anywhere else has been taken by a paper.
    /// </summary>
    /// <param name="competitionPath">The path of the competition the problem's round hangs off.</param>
    /// <returns>Whether it sits among the proposals.</returns>
    public static bool IsInPool(string competitionPath) =>
        // The problem's round hangs at or under the proposals node
        TaxonomySlugs.IsAtOrUnder(competitionPath, HostedTaxonomy.ProposalsPath);

    /// <summary>
    /// Whether a proposal that has not been deleted is still in the selection: in the pool, or in a round of a
    /// hosted group that has not opened.
    /// </summary>
    /// <param name="competitionPath">The path of the competition the problem's round hangs off.</param>
    /// <param name="groupOpensAt">
    /// When the hosted group the round belongs to opens; null for a round of no hosted group.
    /// </param>
    /// <param name="now">The instant the group's opening is read against.</param>
    /// <returns>Whether the selection still holds it.</returns>
    public static bool IsInSelection(string competitionPath, DateTimeOffset? groupOpensAt, DateTimeOffset now) =>
        // Among the proposals, or in a round still to open
        IsInPool(competitionPath) || groupOpensAt > now;

    /// <summary>
    /// Whether a hosted group still takes a board: it has not opened, it closes at some point, and it runs rounds
    /// nothing has filled yet. A group that never closes is the practice one, which nobody picks papers for.
    /// </summary>
    /// <param name="opensAt"><inheritdoc cref="HostedGroup.OpensAt" path="/summary"/></param>
    /// <param name="closesAt"><inheritdoc cref="HostedGroup.ClosesAt" path="/summary"/></param>
    /// <param name="problemsHeld">How many problems each of the group's rounds holds.</param>
    /// <param name="now">The instant the group's opening is read against.</param>
    /// <returns>Whether a board can be finalized into it.</returns>
    public static bool TakesBoard(
        DateTimeOffset opensAt, DateTimeOffset? closesAt, IReadOnlyCollection<int> problemsHeld, DateTimeOffset now) =>
        // Not yet open, closing at some point, with rounds that are all still empty
        opensAt > now && closesAt is not null && problemsHeld.Count > 0 && problemsHeld.All(held => held == 0);
}

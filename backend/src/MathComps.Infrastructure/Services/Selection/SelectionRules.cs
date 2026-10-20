using MathComps.Domain.EfCoreEntities;
using MathComps.Domain.Taxonomy;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Problems;
using Microsoft.EntityFrameworkCore;

namespace MathComps.Infrastructure.Services.Selection;

/// <summary>
/// The rules every part of the problem selection shares: writes run one at a time, a board changes only while it is
/// a draft, the reads and the writes agree on which problems are still in the pool, and the reads agree on which
/// conversations belong to an organization.
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
    /// Reads a proposal of one organization's pool that has not been deleted, tracked, with its problem, the
    /// problem's round, and that round's competition.
    /// </summary>
    /// <param name="dbContext">The write's context.</param>
    /// <param name="organizationSlug">
    /// The <see cref="Organization.Slug"/> of the organization whose pool the proposal has to be in.
    /// </param>
    /// <param name="proposalId">The proposal, which is its problem's id.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>The proposal.</returns>
    /// <exception cref="SelectionTargetNotFoundException">
    /// Thrown when no live proposal of the organization's pool has the id.
    /// </exception>
    public static async Task<Proposal> ReadProposalAsync(
        MathCompsDbContext dbContext, string organizationSlug, Guid proposalId, CancellationToken cancellationToken) =>
        // The proposal, refused like one that is not there once it has been deleted or where it is another pool's
        await dbContext.Proposals
            .Include(proposal => proposal.Problem.Round.Competition)
            .Where(proposal => proposal.ProblemId == proposalId
                && proposal.DeletedAt == null
                && proposal.Organization.Slug == organizationSlug)
            .FirstOrDefaultAsync(cancellationToken)
        ?? throw new SelectionTargetNotFoundException();

    /// <summary>
    /// Reads a draft board of one organization with its papers, their categories and their slot rows, tracked.
    /// </summary>
    /// <param name="dbContext">The write's context.</param>
    /// <param name="organizationSlug">
    /// The <see cref="Organization.Slug"/> of the organization whose selection the board is in.
    /// </param>
    /// <param name="boardId">The board.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>The board.</returns>
    /// <exception cref="SelectionTargetNotFoundException">
    /// Thrown when no board of the organization has the id.
    /// </exception>
    /// <exception cref="SelectionBoardOpenedException">Thrown when the board's group has opened.</exception>
    /// <exception cref="SelectionBoardFinalizedException">Thrown when the board is finalized.</exception>
    public static async Task<SelectionBoard> ReadDraftAsync(
        MathCompsDbContext dbContext, string organizationSlug, Guid boardId, CancellationToken cancellationToken)
    {
        // The board with everything on it, and the group it was finalized into, refused like one that is not there
        // where it is another organization's
        var board = await dbContext.SelectionBoards
            .Include(candidate => candidate.HostedGroup)
            .Include(candidate => candidate.Papers).ThenInclude(paper => paper.Slots)
            .Include(candidate => candidate.Papers).ThenInclude(paper => paper.Category)
            .FirstOrDefaultAsync(
                candidate => candidate.Id == boardId && candidate.Organization.Slug == organizationSlug,
                cancellationToken)
            ?? throw new SelectionTargetNotFoundException();

        // Once its competitions run, students are sitting what the board holds
        if (board.HostedGroup is { } group && group.OpensAt <= DateTimeOffset.UtcNow)
            throw new SelectionBoardOpenedException();

        // A finalized board's slots are its group's rounds, which take no change
        if (board.HostedGroupId is not null)
            throw new SelectionBoardFinalizedException();

        // A draft
        return board;
    }

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
    /// Narrows proposals to the ones outside the hosted groups that have opened: in a round of no hosted group, or
    /// of one still to open. A deleted proposal is among them, since it stays in the pool.
    /// </summary>
    /// <param name="source">The proposals.</param>
    /// <param name="now">The instant a group's opening is read against.</param>
    /// <returns>The proposals narrowed.</returns>
    public static IQueryable<Proposal> WhereOutsideOpenedGroups(this IQueryable<Proposal> source, DateTimeOffset now) =>
        // In a round of no hosted group or of one still to open
        source.Where(proposal =>
            proposal.Problem.Round.HostedGroupId == null || proposal.Problem.Round.HostedGroup!.OpensAt > now);

    /// <summary>
    /// Narrows proposals to the ones the selection may still hold: not deleted, and outside the hosted groups that
    /// have opened (<see cref="WhereOutsideOpenedGroups"/>). <see cref="IsInSelection"/> decides the rest on what the
    /// query reads.
    /// </summary>
    /// <param name="source">The proposals.</param>
    /// <param name="now">The instant a group's opening is read against.</param>
    /// <returns>The proposals narrowed.</returns>
    public static IQueryable<Proposal> WhereSelectionMayHold(this IQueryable<Proposal> source, DateTimeOffset now) =>
        // Not deleted, outside the groups that have opened
        source.Where(proposal => proposal.DeletedAt == null).WhereOutsideOpenedGroups(now);

    /// <summary>
    /// Narrows conversations to the ones an admin on some organizations' lists may reach: every one but those
    /// belonging to another organization, by the rule <see cref="IConversationAccess"/> states.
    /// </summary>
    /// <param name="sessions">The conversations.</param>
    /// <param name="proposals">Every proposal.</param>
    /// <param name="organizationIds">The organizations the admin is a member of.</param>
    /// <param name="now">The instant a group's opening is read against.</param>
    /// <returns>The conversations narrowed.</returns>
    public static IQueryable<DefenseSession> WhereReachableByAdmin(
        this IQueryable<DefenseSession> sessions,
        IQueryable<Proposal> proposals,
        IReadOnlyList<Guid> organizationIds,
        DateTimeOffset now)
    {
        // The other organizations' proposals outside the groups that have opened, deleted or not
        var foreignProposals = proposals
            .WhereOutsideOpenedGroups(now)
            .Where(proposal => !organizationIds.Contains(proposal.OrganizationId));

        // Every conversation about none of them
        return sessions.Where(session => session.ProblemTarget == null
            || !foreignProposals.Any(proposal => proposal.ProblemId == session.ProblemTarget.ProblemId));
    }

    /// <summary>
    /// Whether a board is still in the selection: a draft, or finalized into a hosted group that has not opened.
    /// </summary>
    /// <param name="groupOpensAt">When the hosted group the board was finalized into opens; null for a draft.</param>
    /// <param name="now">The instant the group's opening is read against.</param>
    /// <returns>Whether the selection still holds it.</returns>
    public static bool IsBoardInSelection(DateTimeOffset? groupOpensAt, DateTimeOffset now) =>
        // A draft, or filling a group still to open
        groupOpensAt is null || groupOpensAt > now;
}

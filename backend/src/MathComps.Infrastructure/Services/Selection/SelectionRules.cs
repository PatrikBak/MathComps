using MathComps.Domain.Contracts.Competitions;
using MathComps.Domain.EfCoreEntities;
using MathComps.Domain.Taxonomy;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Problems;
using Microsoft.EntityFrameworkCore;

namespace MathComps.Infrastructure.Services.Selection;

/// <summary>
/// The rules every part of the problem selection shares: writes run one at a time, a board changes only while it is
/// a draft, the reads and the writes agree on which problems are still in the pool, the read and the finalize agree
/// on whether a board can be finalized into its group and which round each paper fills, and the reads agree on which
/// conversations belong to an organization.
/// </summary>
internal static class SelectionRules
{
    /// <summary>
    /// Runs one selection write in its own transaction, after every selection write before it has committed. The
    /// write reads what it checks only once it holds the lock, so it never acts on a state another selection write
    /// has since changed.
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

        // Wait for every other selection write to finish.
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
    /// <exception cref="SelectionBoardOpenedException">
    /// Thrown when the board is finalized and its group has opened.
    /// </exception>
    /// <exception cref="SelectionBoardFinalizedException">
    /// Thrown when the board is finalized and its group is still to open.
    /// </exception>
    public static async Task<SelectionBoard> ReadDraftAsync(
        MathCompsDbContext dbContext, string organizationSlug, Guid boardId, CancellationToken cancellationToken)
    {
        // The board with everything on it, and the group it picks for, refused like one that is not there where it
        // is another organization's
        var board = await dbContext.SelectionBoards
            .Include(candidate => candidate.HostedGroup)
            .Include(candidate => candidate.Papers).ThenInclude(paper => paper.Slots)
            .Include(candidate => candidate.Papers).ThenInclude(paper => paper.Category)
            .FirstOrDefaultAsync(
                candidate => candidate.Id == boardId && candidate.Organization.Slug == organizationSlug,
                cancellationToken)
            ?? throw new SelectionTargetNotFoundException();

        // A finalized board's slots are its group's rounds, which take no change. A draft whose group has opened
        // still takes changes, though it never finalizes.
        if (board.IsFinalized)
            throw board.HostedGroup is { } group && group.OpensAt <= DateTimeOffset.UtcNow
                // Students are sitting its rounds
                ? new SelectionBoardOpenedException()
                // Its rounds still to open
                : new SelectionBoardFinalizedException();

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
    /// Whether a proposal that has not been deleted is in the selection: in the pool, or in a round of a hosted
    /// group, where finalizing a board put it. A proposal in a round of no hosted group outside the pool has left it.
    /// </summary>
    /// <param name="competitionPath">The path of the competition the problem's round hangs off.</param>
    /// <param name="isHosted">Whether the problem's round belongs to a hosted group.</param>
    /// <returns>Whether the selection holds it.</returns>
    public static bool IsInSelection(string competitionPath, bool isHosted) =>
        // Among the proposals, or in a hosted group's round
        IsInPool(competitionPath) || isHosted;

    /// <summary>
    /// Whether a proposal has yet to reach students: in the pool, or in a round of a hosted group still to open.
    /// </summary>
    /// <param name="competitionPath">The path of the competition the problem's round hangs off.</param>
    /// <param name="groupOpensAt">
    /// When the hosted group the round belongs to opens; null for a round of no hosted group.
    /// </param>
    /// <param name="now">The instant the group's opening is read against.</param>
    /// <returns>Whether no student has been given it.</returns>
    public static bool IsUnopened(string competitionPath, DateTimeOffset? groupOpensAt, DateTimeOffset now) =>
        // Among the proposals, or in a round still to open
        IsInPool(competitionPath) || groupOpensAt > now;

    /// <summary>
    /// Narrows conversations about problems to the ones the selection keeps. Every conversation started before the
    /// hosted group the problem's round belongs to opened stays. One started after stays only when somebody on the
    /// list of the organization filing the problem started it, so a student's never does. A problem in a round of
    /// no hosted group keeps every conversation.
    /// </summary>
    /// <param name="source">The conversations about problems.</param>
    /// <param name="proposals">Every proposal, deleted or not.</param>
    /// <returns>The conversations narrowed.</returns>
    public static IQueryable<ProblemDefense> WhereKeptBySelection(
        this IQueryable<ProblemDefense> source, IQueryable<Proposal> proposals) =>
        // In a round of no hosted group, started before its group opened, or started by a member of the
        // organization filing the problem, whose list holds every address lowercased
        source.Where(defense => defense.Problem.Round.HostedGroupId == null
            || defense.Problem.Round.HostedGroup!.OpensAt > defense.DefenseSession.CreatedAt
            || proposals.Any(proposal => proposal.ProblemId == defense.ProblemId
                && proposal.Organization.Members
                    .Select(member => member.Email)
                    .Contains(defense.DefenseSession.User.Email!.ToLower())));

    /// <summary>
    /// Narrows conversations to the ones an admin on some organizations' lists may reach: every one but those
    /// belonging to another organization, by the rule <see cref="IConversationAccess"/> states.
    /// </summary>
    /// <param name="sessions">The conversations.</param>
    /// <param name="dbContext">The context the query is built against.</param>
    /// <param name="organizationIds">The organizations the admin is a member of.</param>
    /// <returns>The conversations narrowed.</returns>
    public static IQueryable<DefenseSession> WhereReachableByAdmin(
        this IQueryable<DefenseSession> sessions, MathCompsDbContext dbContext, IReadOnlyList<Guid> organizationIds)
    {
        // The other organizations' proposals, deleted or not
        var foreignProposals = dbContext.Proposals
            .Where(proposal => !organizationIds.Contains(proposal.OrganizationId));

        // The conversations about one of them that its selection keeps
        var foreignSessionIds = dbContext.ProblemDefenses
            .WhereKeptBySelection(dbContext.Proposals)
            .Where(defense => foreignProposals.Any(proposal => proposal.ProblemId == defense.ProblemId))
            .Select(defense => defense.DefenseSessionId);

        // Every conversation but those
        return sessions.Where(session => !foreignSessionIds.Contains(session.Id));
    }

    /// <summary>
    /// Whether a round is the one a paper fills once its board is finalized into the round's group: the round runs at
    /// the hosted level the paper's category is.
    /// </summary>
    /// <param name="competitionPath">The path of the competition the round hangs off.</param>
    /// <param name="hostedCategory">
    /// The hosted level the paper's category is; null for one no hosted round runs, which fills no round.
    /// </param>
    /// <returns>Whether the paper fills the round.</returns>
    public static bool IsRoundFor(string competitionPath, HostedCompetitionCategory? hostedCategory) =>
        // The paper's category at a hosted level, and the round's level that one
        hostedCategory is { } level && HostedTaxonomy.CategoryOf(competitionPath) == level;

    /// <summary>
    /// Whether a draft's papers can be finalized into its hosted group, whatever its slots hold: the group has not
    /// opened, it closes at some point, it runs rounds nothing has filled yet, and the papers pair one to one with
    /// those rounds by <see cref="IsRoundFor"/>, each paper with as many slots as the group's competitions have
    /// problems. A group that never
    /// closes is the practice one, which nobody picks papers for.
    /// </summary>
    /// <param name="opensAt"><inheritdoc cref="HostedGroup.OpensAt" path="/summary"/></param>
    /// <param name="closesAt"><inheritdoc cref="HostedGroup.ClosesAt" path="/summary"/></param>
    /// <param name="problemCount"><inheritdoc cref="HostedGroup.ProblemCount" path="/summary"/></param>
    /// <param name="rounds">
    /// Each of the group's rounds, by the path of the competition it hangs off, with how many problems it holds.
    /// </param>
    /// <param name="papers">
    /// Each of the board's papers, by the hosted level its category is, with how many slots it has.
    /// </param>
    /// <param name="now">The instant the group's opening is read against.</param>
    /// <returns>Whether the board can be finalized into the group.</returns>
    public static bool CanFinalizeInto(
        DateTimeOffset opensAt,
        DateTimeOffset? closesAt,
        int problemCount,
        IReadOnlyList<(string CompetitionPath, int ProblemsHeld)> rounds,
        IReadOnlyList<(HostedCompetitionCategory? Level, int SlotCount)> papers,
        DateTimeOffset now) =>
        // Not yet open, closing at some point, with rounds that are all still empty
        opensAt > now
        && closesAt is not null
        && rounds.Count > 0
        && rounds.All(round => round.ProblemsHeld == 0)
        // Each paper with as many slots as the group's competitions have problems, filling exactly one round
        && papers.All(paper => paper.SlotCount == problemCount
            && rounds.Count(round => IsRoundFor(round.CompetitionPath, paper.Level)) == 1)
        // And each round filled by exactly one paper
        && rounds.All(round => papers.Count(paper => IsRoundFor(round.CompetitionPath, paper.Level)) == 1);

}

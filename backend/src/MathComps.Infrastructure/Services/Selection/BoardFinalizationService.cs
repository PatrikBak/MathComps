using MathComps.Domain.EfCoreEntities;
using MathComps.Domain.Taxonomy;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Competitions;
using MathComps.Infrastructure.Services.Problems;
using Microsoft.EntityFrameworkCore;

namespace MathComps.Infrastructure.Services.Selection;

/// <summary>
/// Implements <see cref="IBoardFinalizationService"/> over the database, each finalize one write through
/// <see cref="SelectionRules.RunWriteAsync"/>.
/// </summary>
/// <param name="dbContextFactory">Creates the context each finalize runs on.</param>
public sealed class BoardFinalizationService(IDbContextFactory<MathCompsDbContext> dbContextFactory)
    : IBoardFinalizationService
{
    /// <inheritdoc/>
    public Task FinalizeAsync(
        string organizationSlug, Guid boardId, Guid cycleId, CancellationToken cancellationToken = default) =>
        // The finalize, as one selection write
        SelectionRules.RunWriteAsync(dbContextFactory, async dbContext =>
        {
            // Only MathComps' boards fill the hosted groups, so no other organization's selection holds one to finalize
            if (organizationSlug != Organization.MathCompsSlug)
                throw new SelectionTargetNotFoundException();

            // The board, a draft of the organization's own
            var board = await SelectionRules.ReadDraftAsync(dbContext, organizationSlug, boardId, cancellationToken);

            // The group taking the papers
            var group = await dbContext.HostedGroups
                .FirstOrDefaultAsync(candidate => candidate.Id == cycleId, cancellationToken)
                ?? throw new SelectionTargetNotFoundException();

            // The group's rounds, with what each already holds
            var rounds = await ReadRoundsAsync(dbContext, group.Id, cancellationToken);

            // Each paper with the round it fills, which only a group still taking a board offers
            var pairs = PairPapers(board, group, rounds, DateTimeOffset.UtcNow);

            // Every problem the board's papers hold
            var slotted = board.Papers.SelectMany(paper => paper.Slots).Select(slot => slot.ProblemId).ToList();

            // The slotted problems' proposals, tracked, with the round each problem sits in now
            var proposals = await dbContext.Proposals
                .Include(proposal => proposal.Problem.Round.Competition)
                .Where(proposal => slotted.Contains(proposal.ProblemId))
                .ToDictionaryAsync(proposal => proposal.ProblemId, cancellationToken);

            // Only live proposals still in the pool go in, checked once more since this is the step that commits
            // them to a round
            if (proposals.Values.Any(proposal => proposal.DeletedAt is not null
                    || !SelectionRules.IsInPool(proposal.Problem.Round.Competition.Path)))
                throw new SelectionProposalUsedException();

            // And only problems a round can carry
            await EnsureCompleteAsync(dbContext, slotted, cancellationToken);

            // Each problem's place: its paper's round, at its slot's number, on the slug that place calls for
            var moves = pairs
                .SelectMany(pair => pair.Paper.Slots.Select(slot => (
                    proposals[slot.ProblemId].Problem,
                    pair.Round,
                    Number: slot.Position + 1,
                    Slug: ProblemPositions.SlugAt(pair.Round, slot.Position + 1))))
                .ToList();

            // None of those slugs may already answer for a problem outside the move
            await ProblemPositions.RefuseSlugCollisionAsync(
                dbContext, [.. moves.Select(move => move.Slug)], slotted, cancellationToken);

            // Each problem moved to its place
            foreach (var (problem, round, number, slug) in moves)
            {
                // The problem's round, number and slug, written together
                problem.RoundId = round.Id;
                problem.Number = number;
                problem.Slug = slug;
            }

            // The board's own slot rows deleted, its slots being the rounds from here on
            dbContext.SelectionSlots.RemoveRange(board.Papers.SelectMany(paper => paper.Slots));

            // The board tied to the group it filled
            board.HostedGroupId = group.Id;

            // And the problems leave every draft they still stood on
            await SelectionRules.RemoveSlotsAsync(dbContext, slotted, cancellationToken);
        }, cancellationToken);

    /// <summary>
    /// Reads every round a group runs, tracked, each with its competition, season and problems.
    /// </summary>
    /// <param name="dbContext">The write's context.</param>
    /// <param name="groupId">The group.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>The group's rounds.</returns>
    private static Task<List<Round>> ReadRoundsAsync(
        MathCompsDbContext dbContext, Guid groupId, CancellationToken cancellationToken) =>
        // The group's rounds with everything a problem's position is read from
        dbContext.Rounds
            .Include(round => round.Competition)
            .Include(round => round.Season)
            .Include(round => round.Problems)
            .Where(round => round.HostedGroupId == groupId)
            .ToListAsync(cancellationToken);

    /// <summary>
    /// Refuses problems a hosted round could not carry.
    /// </summary>
    /// <param name="dbContext">The write's context.</param>
    /// <param name="problemIds">The problems going into a round.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>A task that completes once they have passed.</returns>
    /// <exception cref="SelectionProblemIncompleteException">
    /// Thrown when one of them is not written in every language.
    /// </exception>
    private static async Task EnsureCompleteAsync(
        MathCompsDbContext dbContext, IReadOnlyCollection<Guid> problemIds, CancellationToken cancellationToken)
    {
        // Whether any of the problems lacks a statement or a solution in some language
        var isIncomplete = await dbContext.Problems
            .Where(problem => problemIds.Contains(problem.Id))
            .AnyAsync(HostedProblemTexts.IsIncomplete, cancellationToken);

        // A hosted round can't carry such a problem
        if (isIncomplete)
            throw new SelectionProblemIncompleteException();
    }

    /// <summary>
    /// Pairs a draft's papers one to one with the rounds of a group that still takes a board, by the hosted level each
    /// paper's category is.
    /// </summary>
    /// <param name="board">The board, with its papers, their categories and slot rows.</param>
    /// <param name="group">The group.</param>
    /// <param name="rounds">The group's rounds, with their competitions and problems.</param>
    /// <param name="now">The instant the group's opening is read against.</param>
    /// <returns>Each paper with the round it fills.</returns>
    /// <exception cref="SelectionFinalizeBlockedException">
    /// Thrown when the board cannot be finalized into the group.
    /// </exception>
    private static List<(SelectionPaper Paper, Round Round)> PairPapers(
        SelectionBoard board, HostedGroup group, IReadOnlyList<Round> rounds, DateTimeOffset now)
    {
        // A group that no longer takes a board has nothing to pair the papers with
        if (!SelectionRules.TakesBoard(
                group.OpensAt, group.ClosesAt, [.. rounds.Select(round => round.Problems.Count)], now))
            throw new SelectionFinalizeBlockedException();

        // The hosted level each round runs at
        var roundLevels = rounds.Select(round => HostedTaxonomy.CategoryOf(round.Competition.Path)).ToList();

        // The hosted level each paper's category is
        var paperLevels = board.Papers.Select(paper => paper.Category.HostedCategory).ToList();

        // Every round at a hosted level of its own, and the papers' categories at exactly those levels, one each
        if (roundLevels.Contains(null)
            || roundLevels.Distinct().Count() != roundLevels.Count
            || !paperLevels.Order().SequenceEqual(roundLevels.Order()))
            throw new SelectionFinalizeBlockedException();

        // Every paper asking as many problems as the group's competitions do, and every slot filled
        if (board.Papers.Any(paper => paper.SlotCount != group.ProblemCount || paper.Slots.Count != paper.SlotCount))
            throw new SelectionFinalizeBlockedException();

        // Each paper with the round of its category's hosted level
        return
        [
            .. board.Papers.Select(paper => (
                paper,
                rounds.Single(round =>
                    SelectionRules.IsRoundFor(round.Competition.Path, paper.Category.HostedCategory)))),
        ];
    }
}

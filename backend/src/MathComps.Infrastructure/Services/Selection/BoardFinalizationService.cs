using MathComps.Domain.EfCoreEntities;
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
    public Task FinalizeAsync(string organizationSlug, Guid boardId, CancellationToken cancellationToken = default) =>
        // The finalize, as one selection write
        SelectionRules.RunWriteAsync(dbContextFactory, async dbContext =>
        {
            // The board, a draft of the organization's own
            var board = await SelectionRules.ReadDraftAsync(dbContext, organizationSlug, boardId, cancellationToken);

            // The group the board picks for; a board picking for no group can't be finalized
            var group = board.HostedGroup ?? throw new SelectionFinalizeBlockedException();

            // The group's rounds, with what each already holds
            var rounds = await ReadRoundsAsync(dbContext, group.Id, cancellationToken);

            // Each paper with the round it fills
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

            // The board finalized, its group's rounds holding its papers
            board.IsFinalized = true;

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
    /// Pairs a draft's papers one to one with the rounds of its group, each paper with the round
    /// <see cref="SelectionRules.IsRoundFor"/> gives it.
    /// </summary>
    /// <param name="board">The board, with its papers, their categories and slot rows.</param>
    /// <param name="group">The group the board picks for.</param>
    /// <param name="rounds">The group's rounds, with their competitions and problems.</param>
    /// <param name="now">The instant the group's opening is read against.</param>
    /// <returns>Each paper with the round it fills.</returns>
    /// <exception cref="SelectionFinalizeBlockedException">
    /// Thrown when the board cannot be finalized into the group, or a slot stands empty.
    /// </exception>
    private static List<(SelectionPaper Paper, Round Round)> PairPapers(
        SelectionBoard board, HostedGroup group, IReadOnlyList<Round> rounds, DateTimeOffset now)
    {
        // The board has to be finalizable into its group: the group still to open, its rounds empty, and the papers
        // pairing with them
        if (!SelectionRules.CanFinalizeInto(
                group.OpensAt,
                group.ClosesAt,
                group.ProblemCount,
                [.. rounds.Select(round => (round.Competition.Path, round.Problems.Count))],
                [.. board.Papers.Select(paper => (paper.Category.HostedCategory, paper.SlotCount))],
                now))
            throw new SelectionFinalizeBlockedException();

        // And every slot has to be filled, since a round is either empty or full
        if (board.Papers.Any(paper => paper.Slots.Count != paper.SlotCount))
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

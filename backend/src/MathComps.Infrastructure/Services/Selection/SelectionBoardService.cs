using MathComps.Domain.Contracts.Selection;
using MathComps.Domain.EfCoreEntities;
using MathComps.Domain.Taxonomy;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Competitions;
using MathComps.Infrastructure.Services.Problems;
using Microsoft.EntityFrameworkCore;

namespace MathComps.Infrastructure.Services.Selection;

/// <summary>
/// Implements <see cref="ISelectionBoardService"/> over the database, each change one write through
/// <see cref="SelectionRules.RunWriteAsync"/>. A draft's slots are its <see cref="SelectionSlot"/> rows; a
/// finalized board's are its group's rounds, changed through <see cref="ProblemPositions"/>.
/// </summary>
/// <param name="dbContextFactory">Creates the context each change runs on.</param>
public sealed class SelectionBoardService(IDbContextFactory<MathCompsDbContext> dbContextFactory)
    : ISelectionBoardService
{
    /// <inheritdoc/>
    public Task PlaceAsync(SlotAddress slot, Guid proposalId, CancellationToken cancellationToken = default) =>
        // The placement, as one selection write
        SelectionRules.RunWriteAsync(dbContextFactory, async dbContext =>
        {
            // The board, which has to be one still taking changes
            var board = await ReadEditableBoardAsync(dbContext, slot.BoardId, cancellationToken);

            // The paper holding the slot
            var paper = PaperOf(board, slot);

            // The proposal going in
            var proposal = await SelectionRules.ReadProposalAsync(dbContext, proposalId, cancellationToken);

            // A finalized board's slot is a position in a round
            if (board.HostedGroupId is { } groupId)
                await PlaceInRoundAsync(dbContext, groupId, paper, slot.Index, proposal.Problem, cancellationToken);

            // A draft's is a slot row
            else
                PlaceOnDraft(dbContext, board, paper, slot.Index, proposal.Problem);
        }, cancellationToken);

    /// <inheritdoc/>
    public Task ClearSlotAsync(SlotAddress slot, CancellationToken cancellationToken = default) =>
        // The clearing, as one selection write
        SelectionRules.RunWriteAsync(dbContextFactory, async dbContext =>
        {
            // The board, which has to be one still taking changes
            var board = await ReadEditableBoardAsync(dbContext, slot.BoardId, cancellationToken);

            // The paper holding the slot
            var paper = PaperOf(board, slot);

            // A round never stands part-filled, so a finalized paper keeps every slot
            if (board.HostedGroupId is not null)
                throw new SelectionPaperFinalizedException();

            // The slot emptied, its problem back in the pool
            SetSlot(dbContext, paper, slot.Index, null);
        }, cancellationToken);

    /// <inheritdoc/>
    public Task MoveSlotAsync(
        SlotAddress slot, SlotDirection direction, CancellationToken cancellationToken = default) =>
        // The trade, as one selection write
        SelectionRules.RunWriteAsync(dbContextFactory, async dbContext =>
        {
            // The board, which has to be one still taking changes
            var board = await ReadEditableBoardAsync(dbContext, slot.BoardId, cancellationToken);

            // The paper holding the slot
            var paper = PaperOf(board, slot);

            // The neighbour's index, one above or below the slot
            var neighbour = direction switch
            {
                SlotDirection.Up => slot.Index - 1,
                SlotDirection.Down => slot.Index + 1,
                _ => throw new ArgumentOutOfRangeException(nameof(direction), direction, "Unknown slot direction."),
            };

            // The neighbour has to be a slot of the same paper
            if (neighbour < 0 || neighbour >= paper.SlotCount)
                throw new SelectionTargetNotFoundException();

            // A finalized board's two slots are two problems of one round, which trade numbers
            if (board.HostedGroupId is { } groupId)
            {
                // The round the paper became
                var round = await ReadRoundOfAsync(dbContext, groupId, paper, cancellationToken);

                // The two problems trading
                await ExchangeAsync(
                    dbContext, ProblemAt(round, slot.Index), ProblemAt(round, neighbour), cancellationToken);
            }

            // A draft's are two slots, which trade what they hold
            else
            {
                // What stands in each of the two slots, read before either changes
                var here = ProblemIdAt(paper, slot.Index);
                var there = ProblemIdAt(paper, neighbour);

                // Each slot takes what the other held
                SetSlot(dbContext, paper, slot.Index, there);
                SetSlot(dbContext, paper, neighbour, here);
            }
        }, cancellationToken);

    /// <inheritdoc/>
    public Task FinalizeAsync(Guid boardId, Guid cycleId, CancellationToken cancellationToken = default) =>
        // The finalize, as one selection write
        SelectionRules.RunWriteAsync(dbContextFactory, async dbContext =>
        {
            // The board, which has to be one still taking changes
            var board = await ReadEditableBoardAsync(dbContext, boardId, cancellationToken);

            // A finalized board already has its rounds
            if (board.HostedGroupId is not null)
                throw new SelectionBoardFinalizedException();

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
    /// Reads a board with its papers and their slot rows, tracked, refusing one whose group has opened.
    /// </summary>
    /// <param name="dbContext">The write's context.</param>
    /// <param name="boardId">The board.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>The board.</returns>
    /// <exception cref="SelectionTargetNotFoundException">Thrown when no board has the id.</exception>
    /// <exception cref="SelectionBoardOpenedException">Thrown when the board's group has opened.</exception>
    private static async Task<SelectionBoard> ReadEditableBoardAsync(
        MathCompsDbContext dbContext, Guid boardId, CancellationToken cancellationToken)
    {
        // The board with everything on it, and the group it was finalized into
        var board = await dbContext.SelectionBoards
            .Include(candidate => candidate.HostedGroup)
            .Include(candidate => candidate.Papers).ThenInclude(paper => paper.Slots)
            .FirstOrDefaultAsync(candidate => candidate.Id == boardId, cancellationToken)
            ?? throw new SelectionTargetNotFoundException();

        // Once its competitions run, students are sitting what the board holds
        if (board.HostedGroup is { } group && group.OpensAt <= DateTimeOffset.UtcNow)
            throw new SelectionBoardOpenedException();

        // A board still taking changes
        return board;
    }

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
    /// Reads the round a finalized paper became, which is its group's round of the paper's category.
    /// </summary>
    /// <param name="dbContext">The write's context.</param>
    /// <param name="groupId">The group the paper's board was finalized into.</param>
    /// <param name="paper">The paper.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>The round, tracked, with its competition, season and problems.</returns>
    /// <exception cref="SelectionTargetNotFoundException">
    /// Thrown when the group runs no round in the paper's category.
    /// </exception>
    private static async Task<Round> ReadRoundOfAsync(
        MathCompsDbContext dbContext, Guid groupId, SelectionPaper paper, CancellationToken cancellationToken) =>
        // The one round of the group in the paper's category, the one finalize paired the paper with
        (await ReadRoundsAsync(dbContext, groupId, cancellationToken))
            .SingleOrDefault(round => HostedTaxonomy.CategoryOf(round.Competition.Path) == paper.Category)
        ?? throw new SelectionTargetNotFoundException();

    /// <summary>
    /// Puts a problem into a finalized paper's slot, trading positions with the problem standing there. A newcomer
    /// from the pool sends that problem to the newcomer's place in the pool; one already on the board sends it to
    /// the newcomer's old slot.
    /// </summary>
    /// <param name="dbContext">The write's context.</param>
    /// <param name="groupId">The group the paper's board was finalized into.</param>
    /// <param name="paper">The paper.</param>
    /// <param name="index">The slot, from zero.</param>
    /// <param name="newcomer">The problem going in, with its round and that round's competition and season.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>A task that completes once the problems have traded.</returns>
    /// <exception cref="SelectionProposalUsedException">
    /// Thrown when the newcomer stands in neither the pool nor the board's rounds.
    /// </exception>
    private static async Task PlaceInRoundAsync(
        MathCompsDbContext dbContext, Guid groupId, SelectionPaper paper, int index, Problem newcomer,
        CancellationToken cancellationToken)
    {
        // The round the paper became
        var round = await ReadRoundOfAsync(dbContext, groupId, paper, cancellationToken);

        // The problem standing in the slot
        var occupant = ProblemAt(round, index);

        // The newcomer already stands in the slot, so nothing moves
        if (occupant.Id == newcomer.Id)
            return;

        // One of this board's own problems trades places within the board
        if (newcomer.Round.HostedGroupId == groupId)
        {
            // The newcomer and the occupant trade positions
            await ExchangeAsync(dbContext, newcomer, occupant, cancellationToken);

            // Done, both problems staying on the board
            return;
        }

        // Anything else that is not in the pool belongs to some other paper
        if (!SelectionRules.IsInPool(newcomer.Round.Competition.Path))
            throw new SelectionProposalUsedException();

        // A pool problem only goes into a round that can carry it
        await EnsureCompleteAsync(dbContext, [newcomer.Id], cancellationToken);

        // The newcomer takes the slot, the occupant going back to the pool with its conversations
        await ExchangeAsync(dbContext, newcomer, occupant, cancellationToken);

        // The newcomer leaves every draft it stood on, a paper having taken it
        await SelectionRules.RemoveSlotsAsync(dbContext, [newcomer.Id], cancellationToken);
    }

    /// <summary>
    /// Puts a pool problem into a draft's slot. One already elsewhere on the board trades places with whatever
    /// held the slot, so a problem never stands on one board twice; one coming from the pool sends the slot's old
    /// problem back to it.
    /// </summary>
    /// <param name="dbContext">The write's context.</param>
    /// <param name="board">The board, with its papers and slot rows.</param>
    /// <param name="paper">The paper holding the slot.</param>
    /// <param name="index">The slot, from zero.</param>
    /// <param name="problem">The problem going in, with its round's competition.</param>
    /// <exception cref="SelectionProposalUsedException">Thrown when the problem is not in the pool.</exception>
    private static void PlaceOnDraft(
        MathCompsDbContext dbContext, SelectionBoard board, SelectionPaper paper, int index, Problem problem)
    {
        // A draft takes only what is still in the pool
        if (!SelectionRules.IsInPool(problem.Round.Competition.Path))
            throw new SelectionProposalUsedException();

        // Where on this board the problem already stands, if anywhere
        var source = board.Papers
            .SelectMany(candidate => candidate.Slots)
            .FirstOrDefault(slot => slot.ProblemId == problem.Id);

        // What stands in the slot now, read before anything moves
        var occupant = ProblemIdAt(paper, index);

        // The problem takes the slot
        SetSlot(dbContext, paper, index, problem.Id);

        // The problem's old slot on the board, if any and if not the same one, takes what stood in the new one
        if (source is not null && (source.PaperId != paper.Id || source.Position != index))
            SetSlot(dbContext, source.Paper, source.Position, occupant);
    }

    /// <summary>
    /// Puts a problem into a draft's slot, or empties it.
    /// </summary>
    /// <param name="dbContext">The write's context.</param>
    /// <param name="paper">The paper, with its slot rows.</param>
    /// <param name="index">The slot, from zero.</param>
    /// <param name="problemId">The problem, or null to empty the slot.</param>
    private static void SetSlot(MathCompsDbContext dbContext, SelectionPaper paper, int index, Guid? problemId)
    {
        // The slot's row as it stands
        var row = paper.Slots.FirstOrDefault(slot => slot.Position == index);

        // The slot emptied, where it holds something
        if (problemId is null)
        {
            // An empty slot has no row
            if (row is not null)
            {
                // The row deleted
                dbContext.SelectionSlots.Remove(row);

                // The paper's slots without the row
                paper.Slots.Remove(row);
            }
        }

        // The slot refilled, where it already holds a problem
        else if (row is not null)
            row.ProblemId = problemId.Value;

        // The slot filled, where it stood empty
        else
            dbContext.SelectionSlots.Add(
                new SelectionSlot { PaperId = paper.Id, Position = index, ProblemId = problemId.Value });
    }

    /// <summary>
    /// Trades two problems' positions.
    /// </summary>
    /// <param name="dbContext">The write's context, tracking both problems.</param>
    /// <param name="first">The first problem, with its round and that round's competition and season.</param>
    /// <param name="second">The second problem, with its round and that round's competition and season.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>A task that completes once the two have traded.</returns>
    private static async Task ExchangeAsync(
        MathCompsDbContext dbContext, Problem first, Problem second, CancellationToken cancellationToken)
    {
        // What the trade writes, refused when a slug it needs is taken
        var exchange = await ProblemPositions.PlanExchangeAsync(dbContext, first, second, cancellationToken);

        // The trade itself
        await ProblemPositions.ExchangeAsync(dbContext, first, second, exchange, cancellationToken);
    }

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
    /// Pairs a draft's papers one to one with the rounds of a group that still takes a board, by category.
    /// </summary>
    /// <param name="board">The board, with its papers and slot rows.</param>
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

        // The category each round runs at
        var roundCategories = rounds.Select(round => HostedTaxonomy.CategoryOf(round.Competition.Path)).ToList();

        // The category each paper fills
        var paperCategories = board.Papers.Select(paper => paper.Category).ToList();

        // Every round at a category of its own, and the papers filling exactly those categories, one each
        if (roundCategories.Contains(null)
            || roundCategories.Distinct().Count() != roundCategories.Count
            || !paperCategories.Order().SequenceEqual(roundCategories.Order()))
            throw new SelectionFinalizeBlockedException();

        // Every paper asking as many problems as the group's competitions do, and every slot filled
        if (board.Papers.Any(paper => paper.SlotCount != group.ProblemCount || paper.Slots.Count != paper.SlotCount))
            throw new SelectionFinalizeBlockedException();

        // Each paper with the round of its category
        return
        [
            .. board.Papers.Select(paper => (
                paper,
                rounds.Single(round => HostedTaxonomy.CategoryOf(round.Competition.Path) == paper.Category))),
        ];
    }

    /// <summary>
    /// Finds the paper a slot belongs to on its board.
    /// </summary>
    /// <param name="board">The board, with its papers.</param>
    /// <param name="slot">The slot.</param>
    /// <returns>The paper.</returns>
    /// <exception cref="SelectionTargetNotFoundException">Thrown when the board has no such paper or slot.</exception>
    private static SelectionPaper PaperOf(SelectionBoard board, SlotAddress slot)
    {
        // The paper, one of this board's own
        var paper = board.Papers.FirstOrDefault(candidate => candidate.Id == slot.PaperId)
            ?? throw new SelectionTargetNotFoundException();

        // A slot past either end of the paper names nothing
        if (slot.Index < 0 || slot.Index >= paper.SlotCount)
            throw new SelectionTargetNotFoundException();

        // The paper holding the slot
        return paper;
    }

    /// <summary>
    /// Finds the problem a full round holds at a slot.
    /// </summary>
    /// <param name="round">The round, with its problems.</param>
    /// <param name="index">The slot, from zero.</param>
    /// <returns>The problem.</returns>
    private static Problem ProblemAt(Round round, int index) =>
        // A finalized round is full, so the number is held
        round.Problems.Single(problem => problem.Number == index + 1);

    /// <summary>
    /// Reads what stands in a draft's slot.
    /// </summary>
    /// <param name="paper">The paper, with its slot rows.</param>
    /// <param name="index">The slot, from zero.</param>
    /// <returns>The problem's id, or null for an empty slot.</returns>
    private static Guid? ProblemIdAt(SelectionPaper paper, int index) =>
        // The problem on the slot's row, or null for an empty slot
        paper.Slots.FirstOrDefault(slot => slot.Position == index)?.ProblemId;
}

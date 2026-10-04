using MathComps.Domain.Contracts.Competitions;
using MathComps.Domain.Contracts.Selection;
using MathComps.Domain.EfCoreEntities;
using MathComps.Domain.Localization;
using MathComps.Infrastructure.Extensions;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Problems;
using MathComps.Infrastructure.Services.Selection;
using MathComps.Infrastructure.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace MathComps.Infrastructure.Tests.Selection;

/// <summary>
/// Covers <see cref="SelectionBoardService"/>: filling a draft's slots, finalizing a board into a hosted group's
/// rounds, and changing a finalized board, where every change moves real problems.
/// </summary>
/// <remarks>
/// The seed is sixteen proposals, the October and November groups not yet open with empty rounds, a September
/// group already open, the full October board and a part-filled spare one sharing problem 1 with it.
/// Problem 15 is written in English alone, and problem 16 sits in a September round rather than in the pool.
/// </remarks>
/// <param name="fixture">The shared PostgreSQL container fixture.</param>
public class SelectionBoardServicePostgresTests(PostgresContainerFixture fixture)
    : PostgresTestBase<ISelectionBoardService>(fixture)
{
    /// <summary>
    /// The proposals by their number.
    /// </summary>
    private readonly Dictionary<int, Guid> _proposals = [];

    /// <summary>
    /// The round the pool's problems are parked in.
    /// </summary>
    private Guid _proposalsRoundId;

    /// <summary>
    /// The October group, not yet open, its rounds empty.
    /// </summary>
    private Guid _octoberId;

    /// <summary>
    /// The November group, not yet open, its rounds empty.
    /// </summary>
    private Guid _novemberId;

    /// <summary>
    /// The September group, already open.
    /// </summary>
    private Guid _septemberId;

    /// <summary>
    /// The October board: problems 1 to 12, four a paper.
    /// </summary>
    private Guid _octoberBoardId;

    /// <summary>
    /// A spare board: problem 1, then 13, in its elementary paper, everything else empty.
    /// </summary>
    private Guid _spareBoardId;

    /// <inheritdoc/>
    protected override void ConfigureServices(IServiceCollection services) =>
        // The service under test, with the rest of the selection.
        services.AddProblemSelectionServices();

    /// <summary>
    /// A pool problem put into an occupied draft slot takes it, and sends the occupant back to the pool: off this
    /// board, while another board it stands on keeps it.
    /// </summary>
    [Fact]
    public Task A_pool_problem_placed_over_another_takes_its_slot() => RunTestAsync(async service =>
    {
        // Problem 13 into the October board's first elementary slot, which problem 1 holds
        await service.PlaceAsync(
            await SlotAsync(_octoberBoardId, HostedCompetitionCategory.Elementary, 0), _proposals[13]);

        // It stands there, and problem 1 is gone from the paper
        Assert.Equal(
            [_proposals[13], _proposals[2], _proposals[3], _proposals[4]],
            await DraftSlotsAsync(_octoberBoardId, HostedCompetitionCategory.Elementary));

        // While the spare board still holds both
        Assert.Equal(
            [_proposals[1], _proposals[13], null, null],
            await DraftSlotsAsync(_spareBoardId, HostedCompetitionCategory.Elementary));
    });

    /// <summary>
    /// A problem already on the board trades places with whatever held the slot it is put into, so it never
    /// stands on one board twice.
    /// </summary>
    [Fact]
    public Task A_problem_placed_elsewhere_on_its_board_trades_places() => RunTestAsync(async service =>
    {
        // Problem 6, the second intermediate one, into the first elementary slot
        await service.PlaceAsync(
            await SlotAsync(_octoberBoardId, HostedCompetitionCategory.Elementary, 0), _proposals[6]);

        // It took problem 1's slot
        Assert.Equal(
            [_proposals[6], _proposals[2], _proposals[3], _proposals[4]],
            await DraftSlotsAsync(_octoberBoardId, HostedCompetitionCategory.Elementary));

        // And problem 1 took its old one
        Assert.Equal(
            [_proposals[5], _proposals[1], _proposals[7], _proposals[8]],
            await DraftSlotsAsync(_octoberBoardId, HostedCompetitionCategory.Intermediate));
    });

    /// <summary>
    /// A problem moved onto an empty slot of its own board leaves its old slot empty, there being nothing in the
    /// new one to trade back.
    /// </summary>
    [Fact]
    public Task A_problem_placed_on_an_empty_slot_of_its_board_leaves_its_old_one_empty() => RunTestAsync(
        async service =>
        {
            // Problem 1 to the last elementary slot of the spare board, which stands empty
            await service.PlaceAsync(
                await SlotAsync(_spareBoardId, HostedCompetitionCategory.Elementary, 3), _proposals[1]);

            // Moved, its old slot emptied
            Assert.Equal(
                [null, _proposals[13], null, _proposals[1]],
                await DraftSlotsAsync(_spareBoardId, HostedCompetitionCategory.Elementary));
        });

    /// <summary>
    /// A problem sitting in a hosted round has been taken by a paper, so no draft can take it again.
    /// </summary>
    [Fact]
    public Task A_draft_takes_no_problem_a_paper_has_taken() => RunTestAsync(async service =>
        // Problem 16, which sits in a September round
        await Assert.ThrowsAsync<SelectionProposalUsedException>(async () => await service.PlaceAsync(
            await SlotAsync(_spareBoardId, HostedCompetitionCategory.Advanced, 0), _proposals[16])));

    /// <summary>
    /// A move trades a slot with its neighbour in the same paper. Both are read before either is written, or the
    /// second write would copy the first and leave one problem standing in both.
    /// </summary>
    [Fact]
    public Task A_move_trades_a_draft_slot_with_its_neighbour() => RunTestAsync(async service =>
    {
        // The spare board's second elementary slot one up
        await service.MoveSlotAsync(
            await SlotAsync(_spareBoardId, HostedCompetitionCategory.Elementary, 1), SlotDirection.Up);

        // The two traded
        Assert.Equal(
            [_proposals[13], _proposals[1], null, null],
            await DraftSlotsAsync(_spareBoardId, HostedCompetitionCategory.Elementary));
    });

    /// <summary>
    /// A move down from a paper's last slot is refused, there being no neighbour below it. Let through, it would put
    /// the problem in a slot past the paper's end.
    /// </summary>
    [Fact]
    public Task A_move_past_the_end_of_a_paper_is_refused() => RunTestAsync(async service =>
        // The last elementary slot one further down
        await Assert.ThrowsAsync<SelectionTargetNotFoundException>(async () => await service.MoveSlotAsync(
            await SlotAsync(_octoberBoardId, HostedCompetitionCategory.Elementary, 3), SlotDirection.Down)));

    /// <summary>
    /// Finalizing moves each paper's problems into the round of its category, in slot order and with the slugs
    /// those positions call for. The board is then tied to the group, its slot rows gone, and the problems leave
    /// every draft they still stood on.
    /// </summary>
    [Fact]
    public Task Finalizing_moves_the_papers_into_the_cycles_rounds() => RunTestAsync(async service =>
    {
        // The October board into the October group
        await service.FinalizeAsync(_octoberBoardId, _octoberId);

        // The first elementary problem sits first in the elementary round, on the slug that position calls for
        Assert.Equal(
            ("mathcomps-elementary-october", 1, "76-mathcomps-elementary-october-1"),
            await PositionOfAsync(_proposals[1]));

        // And the last advanced one last in the advanced round
        Assert.Equal(
            ("mathcomps-advanced-october", 4, "76-mathcomps-advanced-october-4"),
            await PositionOfAsync(_proposals[12]));

        // The board's group, and how many slot rows its papers still hold
        var board = await QueryValueAsync(context => context.SelectionBoards
            .Where(candidate => candidate.Id == _octoberBoardId)
            .Select(candidate => new
            {
                candidate.HostedGroupId,
                Slots = candidate.Papers.SelectMany(paper => paper.Slots).Count(),
            })
            .SingleAsync());

        // Tied to the October group
        Assert.Equal(_octoberId, board.HostedGroupId);

        // With no slot rows left
        Assert.Equal(0, board.Slots);

        // And the spare board lost problem 1, keeping problem 13
        Assert.Equal(
            [null, _proposals[13], null, null],
            await DraftSlotsAsync(_spareBoardId, HostedCompetitionCategory.Elementary));
    });

    /// <summary>
    /// A round is either empty or full, so a board with one slot emptied cannot be finalized.
    /// </summary>
    [Fact]
    public Task Finalizing_a_board_with_an_empty_slot_is_refused() => RunTestAsync(async service =>
    {
        // The October board's last elementary slot emptied
        await service.ClearSlotAsync(await SlotAsync(_octoberBoardId, HostedCompetitionCategory.Elementary, 3));

        // Problem 4 back in the pool, the rest of the paper standing
        Assert.Equal(
            [_proposals[1], _proposals[2], _proposals[3], null],
            await DraftSlotsAsync(_octoberBoardId, HostedCompetitionCategory.Elementary));

        // So the board no longer fills the group
        await Assert.ThrowsAsync<SelectionFinalizeBlockedException>(
            () => service.FinalizeAsync(_octoberBoardId, _octoberId));

        // And nothing moved
        Assert.Equal(_proposalsRoundId, await RoundOfAsync(_proposals[1]));
    });

    /// <summary>
    /// A group that has opened is being sat, so no board goes into it, even one whose rounds nothing filled.
    /// </summary>
    [Fact]
    public Task Finalizing_into_an_opened_cycle_is_refused() => RunTestAsync(async service =>
    {
        // The November group opened an hour ago, its rounds still empty
        await QueryAsync(async context =>
        {
            await context.HostedGroups
                .Where(group => group.Id == _novemberId)
                .ExecuteUpdateAsync(setters => setters.SetProperty(
                    group => group.OpensAt, DateTimeOffset.UtcNow.AddHours(-1)));
        });

        // The full October board into it
        await Assert.ThrowsAsync<SelectionFinalizeBlockedException>(
            () => service.FinalizeAsync(_octoberBoardId, _novemberId));

        // And nothing moved
        Assert.Equal(_proposalsRoundId, await RoundOfAsync(_proposals[1]));
    });

    /// <summary>
    /// Every paper has to fill a round of its own category, so a paper outside the categories leaves a round
    /// with nothing to fill it.
    /// </summary>
    [Fact]
    public Task Finalizing_a_paper_no_round_fits_is_refused() => RunTestAsync(async service =>
    {
        // The October board's advanced paper
        var paperId = await PaperIdAsync(_octoberBoardId, HostedCompetitionCategory.Advanced);

        // The paper taken out of the categories
        await QueryAsync(async context =>
        {
            await context.SelectionPapers
                .Where(paper => paper.Id == paperId)
                .ExecuteUpdateAsync(setters =>
                    setters.SetProperty(paper => paper.Category, (HostedCompetitionCategory?)null));
        });

        // So it pairs with no round
        await Assert.ThrowsAsync<SelectionFinalizeBlockedException>(
            () => service.FinalizeAsync(_octoberBoardId, _octoberId));
    });

    /// <summary>
    /// A round holds exactly the number of problems its group announces, so a paper of any other length would
    /// leave it short or over, which the competitions page cannot serve.
    /// </summary>
    [Fact]
    public Task Finalizing_a_paper_longer_than_the_cycles_is_refused() => RunTestAsync(async service =>
    {
        // The October board's elementary paper
        var paperId = await PaperIdAsync(_octoberBoardId, HostedCompetitionCategory.Elementary);

        // Grown to five slots, the fifth filled too
        await QueryAsync(async context =>
        {
            // The fifth slot
            await context.SelectionPapers
                .Where(paper => paper.Id == paperId)
                .ExecuteUpdateAsync(setters => setters.SetProperty(paper => paper.SlotCount, 5));

            // Problem 13 in it
            context.SelectionSlots.Add(
                new SelectionSlot { PaperId = paperId, Position = 4, ProblemId = _proposals[13] });

            // Written
            await context.SaveChangesAsync();
        });

        // Refused
        await Assert.ThrowsAsync<SelectionFinalizeBlockedException>(
            () => service.FinalizeAsync(_octoberBoardId, _octoberId));
    });

    /// <summary>
    /// A round serves every language the site is read in, so a problem written in fewer cannot go into one.
    /// </summary>
    [Fact]
    public Task Finalizing_a_problem_missing_a_language_is_refused() => RunTestAsync(async service =>
    {
        // Problem 15, written in English alone, in place of problem 4
        await SetDraftSlotAsync(_octoberBoardId, HostedCompetitionCategory.Elementary, 3, _proposals[15]);

        // Refused
        await Assert.ThrowsAsync<SelectionProblemIncompleteException>(
            () => service.FinalizeAsync(_octoberBoardId, _octoberId));

        // With nothing moved
        Assert.Equal(_proposalsRoundId, await RoundOfAsync(_proposals[1]));
    });

    /// <summary>
    /// A text holding only whitespace is as missing as no text at all: the examiner refuses a blank solution, so a
    /// round carrying one would fail every reader of that language mid-competition.
    /// </summary>
    [Fact]
    public Task Finalizing_a_problem_with_a_blank_solution_is_refused() => RunTestAsync(async service =>
    {
        // Problem 4's Czech solution blanked to a single space
        await QueryAsync(async context =>
        {
            await context.ProblemTexts
                .Where(text => text.ProblemId == _proposals[4]
                    && text.DocumentType == DocumentType.Solution
                    && text.Language == Language.CS)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(text => text.MarkdownText, " ")
                    .SetProperty(text => text.RawText, (string?)null));
        });

        // Refused like a missing one
        await Assert.ThrowsAsync<SelectionProblemIncompleteException>(
            () => service.FinalizeAsync(_octoberBoardId, _octoberId));
    });

    /// <summary>
    /// Finalize checks every slotted problem is still in the pool, however the draft came to hold one that is not.
    /// </summary>
    [Fact]
    public Task Finalizing_a_problem_a_paper_has_since_taken_is_refused() => RunTestAsync(async service =>
    {
        // Problem 16, sitting in a September round, in place of problem 4
        await SetDraftSlotAsync(_octoberBoardId, HostedCompetitionCategory.Elementary, 3, _proposals[16]);

        // Refused
        await Assert.ThrowsAsync<SelectionProposalUsedException>(
            () => service.FinalizeAsync(_octoberBoardId, _octoberId));
    });

    /// <summary>
    /// The schema leaves a slug free to repeat, so a problem outside the board can already sit on the slug a
    /// round's position calls for. Finalize refuses that before moving anything, since the next import of either
    /// problem would find two rows answering to it.
    /// </summary>
    [Fact]
    public Task Finalizing_onto_a_slug_another_problem_carries_is_refused() => RunTestAsync(async service =>
    {
        // Problem 14, on no board, drifted onto the slug of the elementary round's first position
        await QueryAsync(async context =>
        {
            await context.Problems
                .Where(problem => problem.Id == _proposals[14])
                .ExecuteUpdateAsync(setters =>
                    setters.SetProperty(problem => problem.Slug, "76-mathcomps-elementary-october-1"));
        });

        // The October board, whose first elementary problem needs that slug
        await Assert.ThrowsAsync<ProblemSlugTakenException>(
            () => service.FinalizeAsync(_octoberBoardId, _octoberId));

        // With nothing moved
        Assert.Equal(_proposalsRoundId, await RoundOfAsync(_proposals[1]));
    });

    /// <summary>
    /// A pool problem put onto a finalized paper takes the slot's round and number, and the problem there goes
    /// back to the pool in its place, so the round keeps its count. The newcomer leaves every draft it stood on.
    /// </summary>
    [Fact]
    public Task A_pool_problem_placed_on_a_finalized_paper_swaps_into_the_round() => RunTestAsync(async service =>
    {
        // The October board finalized
        await service.FinalizeAsync(_octoberBoardId, _octoberId);

        // Problem 13 onto the second elementary slot, which problem 2 holds
        await service.PlaceAsync(
            await SlotAsync(_octoberBoardId, HostedCompetitionCategory.Elementary, 1), _proposals[13]);

        // Problem 13 holds it now
        Assert.Equal(
            ("mathcomps-elementary-october", 2, "76-mathcomps-elementary-october-2"),
            await PositionOfAsync(_proposals[13]));

        // And problem 2 sits where problem 13 was parked
        Assert.Equal(
            ("mathcomps-proposals", 13, "76-mathcomps-proposals-13"),
            await PositionOfAsync(_proposals[2]));

        // Problem 13 left the spare board
        Assert.Equal(
            [null, null, null, null],
            await DraftSlotsAsync(_spareBoardId, HostedCompetitionCategory.Elementary));
    });

    /// <summary>
    /// A problem going into a finalized paper has to be one the round can serve, the same as at finalize.
    /// </summary>
    [Fact]
    public Task A_finalized_paper_refuses_a_problem_missing_a_language() => RunTestAsync(async service =>
    {
        // The October board finalized
        await service.FinalizeAsync(_octoberBoardId, _octoberId);

        // Problem 15, written in English alone, onto the second elementary slot, which problem 2 holds
        await Assert.ThrowsAsync<SelectionProblemIncompleteException>(async () => await service.PlaceAsync(
            await SlotAsync(_octoberBoardId, HostedCompetitionCategory.Elementary, 1), _proposals[15]));

        // Problem 2 still holds it
        Assert.Equal(2, (await PositionOfAsync(_proposals[2])).Number);
    });

    /// <summary>
    /// A problem sitting in another group's round belongs to that group's paper, so a finalized board cannot
    /// take it: the trade would rearrange a paper this board does not hold.
    /// </summary>
    [Fact]
    public Task A_finalized_paper_refuses_a_problem_of_another_paper() => RunTestAsync(async service =>
    {
        // The October board finalized
        await service.FinalizeAsync(_octoberBoardId, _octoberId);

        // Problem 16, sitting in a September round, onto a slot
        await Assert.ThrowsAsync<SelectionProposalUsedException>(async () => await service.PlaceAsync(
            await SlotAsync(_octoberBoardId, HostedCompetitionCategory.Elementary, 0), _proposals[16]));

        // It stays where it was
        Assert.Equal("mathcomps-elementary-september", (await PositionOfAsync(_proposals[16])).Path);
    });

    /// <summary>
    /// One of the board's own problems placed on another of its slots trades rounds and numbers with the problem
    /// there, which is how a problem changes papers after finalize.
    /// </summary>
    [Fact]
    public Task A_finalized_boards_own_problem_trades_places_across_papers() => RunTestAsync(async service =>
    {
        // The October board finalized
        await service.FinalizeAsync(_octoberBoardId, _octoberId);

        // Problem 5, first in intermediate, onto the first elementary slot
        await service.PlaceAsync(
            await SlotAsync(_octoberBoardId, HostedCompetitionCategory.Elementary, 0), _proposals[5]);

        // Each sits where the other was
        Assert.Equal(
            ("mathcomps-elementary-october", 1, "76-mathcomps-elementary-october-1"),
            await PositionOfAsync(_proposals[5]));
        Assert.Equal(
            ("mathcomps-intermediate-october", 1, "76-mathcomps-intermediate-october-1"),
            await PositionOfAsync(_proposals[1]));
    });

    /// <summary>
    /// A move on a finalized paper trades the two problems' numbers in the round of the paper's category, each
    /// taking the slug its new number calls for. A slug left behind would still answer for the old position.
    /// </summary>
    [Fact]
    public Task A_move_on_a_finalized_paper_trades_the_problems_numbers() => RunTestAsync(async service =>
    {
        // The October board finalized
        await service.FinalizeAsync(_octoberBoardId, _octoberId);

        // The third advanced slot one down
        await service.MoveSlotAsync(
            await SlotAsync(_octoberBoardId, HostedCompetitionCategory.Advanced, 2), SlotDirection.Down);

        // Problems 11 and 12 traded numbers and slugs in the advanced round
        Assert.Equal(
            ("mathcomps-advanced-october", 4, "76-mathcomps-advanced-october-4"),
            await PositionOfAsync(_proposals[11]));
        Assert.Equal(
            ("mathcomps-advanced-october", 3, "76-mathcomps-advanced-october-3"),
            await PositionOfAsync(_proposals[12]));
    });

    /// <summary>
    /// A round never stands part-filled, so a finalized paper's slot cannot be emptied.
    /// </summary>
    [Fact]
    public Task A_finalized_paper_keeps_every_slot() => RunTestAsync(async service =>
    {
        // The October board finalized
        await service.FinalizeAsync(_octoberBoardId, _octoberId);

        // Emptying the October board's first elementary slot, refused
        await Assert.ThrowsAsync<SelectionPaperFinalizedException>(async () => await service.ClearSlotAsync(
            await SlotAsync(_octoberBoardId, HostedCompetitionCategory.Elementary, 0)));
    });

    /// <summary>
    /// A finalized board's papers are its group's rounds already, so it cannot be finalized again, into that group
    /// or any other. Let through, it would be refused as a board short of problems, which tells the reviewer to
    /// fill slots that no longer exist.
    /// </summary>
    [Fact]
    public Task Finalizing_a_finalized_board_again_is_refused() => RunTestAsync(async service =>
    {
        // The October board finalized
        await service.FinalizeAsync(_octoberBoardId, _octoberId);

        // Finalizing the October board into the November group, refused
        await Assert.ThrowsAsync<SelectionBoardFinalizedException>(
            () => service.FinalizeAsync(_octoberBoardId, _novemberId));
    });

    /// <summary>
    /// Once a board's group opens, students are sitting what it holds, so it takes no change.
    /// </summary>
    [Fact]
    public Task A_board_whose_cycle_has_opened_takes_no_change() => RunTestAsync(async service =>
    {
        // The spare board, as though it had been finalized into the September group
        await QueryAsync(async context =>
        {
            await context.SelectionBoards
                .Where(board => board.Id == _spareBoardId)
                .ExecuteUpdateAsync(setters => setters.SetProperty(board => board.HostedGroupId, _septemberId));
        });

        // Emptying the spare board's first elementary slot, refused for the opened group
        await Assert.ThrowsAsync<SelectionBoardOpenedException>(async () => await service.ClearSlotAsync(
            await SlotAsync(_spareBoardId, HostedCompetitionCategory.Elementary, 0)));
    });

    /// <inheritdoc/>
    protected override async Task SeedDataAsync(MathCompsDbContext context)
    {
        // The season every round sits in
        var season = SelectionSeed.NewSeason(context);

        // The pool's round
        var pool = SelectionSeed.NewProposalsRound(context, season);
        _proposalsRoundId = pool.Id;

        // Fourteen problems written in every language
        foreach (var number in Enumerable.Range(1, 14))
            _proposals[number] = SelectionSeed.NewProposal(context, pool, number, number);

        // Problem 15, written in English alone
        _proposals[15] = SelectionSeed.NewProposal(context, pool, 15, 15, Language.EN);

        // The instant every group's opening is set against
        var now = DateTimeOffset.UtcNow;

        // The groups a board can go into
        _octoberId = SelectionSeed.NewGroup(context, season, "october", now.AddDays(10)).Id;
        _novemberId = SelectionSeed.NewGroup(context, season, "november", now.AddDays(40)).Id;

        // The September group, already open
        var september = SelectionSeed.NewGroup(context, season, "september", now.AddDays(-1));
        _septemberId = september.Id;

        // Problem 16, sitting in a September round
        _proposals[16] = SelectionSeed.NewProposal(context, september.Rounds.First(), 16, 1);

        // The October board, full
        _octoberBoardId = SelectionSeed.NewBoard(
            context, "October", [.. Enumerable.Range(1, 12).Select(number => (Guid?)_proposals[number])]).Id;

        // The spare board, sharing problem 1
        _spareBoardId = SelectionSeed.NewBoard(context, "Spare", _proposals[1], _proposals[13]).Id;

        // Written
        await context.SaveChangesAsync();
    }

    /// <summary>
    /// Addresses one slot of a board's paper of a category.
    /// </summary>
    /// <param name="boardId">The board.</param>
    /// <param name="category">The paper's category.</param>
    /// <param name="index">The slot, from zero.</param>
    /// <returns>The slot's address.</returns>
    private async Task<SlotAddress> SlotAsync(Guid boardId, HostedCompetitionCategory category, int index) =>
        // The address, naming the board's paper of that category
        new(boardId, await PaperIdAsync(boardId, category), index);

    /// <summary>
    /// Reads the id of a board's paper of a category.
    /// </summary>
    /// <param name="boardId">The board.</param>
    /// <param name="category">The paper's category.</param>
    /// <returns>The paper's id.</returns>
    private Task<Guid> PaperIdAsync(Guid boardId, HostedCompetitionCategory category) =>
        // The board's one paper of that category
        QueryValueAsync(context => context.SelectionPapers
            .Where(paper => paper.BoardId == boardId && paper.Category == category)
            .Select(paper => paper.Id)
            .SingleAsync());

    /// <summary>
    /// Reads what stands in each slot of a draft's paper of a category.
    /// </summary>
    /// <param name="boardId">The board.</param>
    /// <param name="category">The paper's category.</param>
    /// <returns>The problem in each slot, null where it stands empty.</returns>
    private async Task<IReadOnlyList<Guid?>> DraftSlotsAsync(Guid boardId, HostedCompetitionCategory category)
    {
        // The board's paper of that category
        var paperId = await PaperIdAsync(boardId, category);

        // The paper's slot rows
        var rows = await QueryValueAsync(context => context.SelectionSlots
            .Where(slot => slot.PaperId == paperId)
            .ToListAsync());

        // Laid out over the paper's four slots
        return
        [
            .. Enumerable.Range(0, 4).Select(index => rows.SingleOrDefault(row => row.Position == index)?.ProblemId),
        ];
    }

    /// <summary>
    /// Puts a problem straight into a draft's slot row, standing in for a board the service never built.
    /// </summary>
    /// <param name="boardId">The board.</param>
    /// <param name="category">The paper's category.</param>
    /// <param name="index">The slot, from zero.</param>
    /// <param name="problemId">The problem.</param>
    /// <returns>A task that completes once the row is written.</returns>
    private async Task SetDraftSlotAsync(
        Guid boardId, HostedCompetitionCategory category, int index, Guid problemId)
    {
        // The paper holding the slot
        var paperId = await PaperIdAsync(boardId, category);

        // The row repointed
        await QueryAsync(async context =>
        {
            await context.SelectionSlots
                .Where(slot => slot.PaperId == paperId && slot.Position == index)
                .ExecuteUpdateAsync(setters => setters.SetProperty(slot => slot.ProblemId, problemId));
        });
    }

    /// <summary>
    /// Reads where a problem sits.
    /// </summary>
    /// <param name="problemId">The problem.</param>
    /// <returns>Its round's competition path, its number there, and its slug.</returns>
    private Task<(string Path, int Number, string Slug)> PositionOfAsync(Guid problemId) =>
        // The problem's position
        QueryValueAsync(async context =>
        {
            // The problem's competition path, number and slug
            var problem = await context.Problems
                .Where(candidate => candidate.Id == problemId)
                .Select(candidate => new { candidate.Round.Competition.Path, candidate.Number, candidate.Slug })
                .SingleAsync();

            // Where the problem sits
            return (problem.Path, problem.Number, problem.Slug);
        });

    /// <summary>
    /// Reads the round a problem sits in.
    /// </summary>
    /// <param name="problemId">The problem.</param>
    /// <returns>The round's id.</returns>
    private Task<Guid> RoundOfAsync(Guid problemId) =>
        // The problem's round
        QueryValueAsync(context => context.Problems
            .Where(problem => problem.Id == problemId)
            .Select(problem => problem.RoundId)
            .SingleAsync());
}

using MathComps.Domain.Contracts.Competitions;
using MathComps.Domain.Contracts.Selection;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Services.Selection;
using MathComps.Infrastructure.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;

namespace MathComps.Infrastructure.Tests.Selection;

/// <summary>
/// Covers <see cref="SelectionBoardService"/>: filling a draft's slots, refusing every change to a finalized board,
/// keeping each organization to its own boards and proposals, and each paper to its category's leads.
/// </summary>
/// <param name="fixture">The shared PostgreSQL container fixture.</param>
public class SelectionBoardServicePostgresTests(PostgresContainerFixture fixture)
    : SelectionBoardPostgresTestBase<ISelectionBoardService>(fixture)
{
    /// <summary>
    /// A pool problem put into an occupied draft slot takes it, and sends the occupant back to the pool: off this
    /// board, while another board it stands on keeps it.
    /// </summary>
    [Fact]
    public Task A_pool_problem_placed_over_another_takes_its_slot() => RunTestAsync(async service =>
    {
        // Problem 13 into the October board's first elementary slot, which problem 1 holds
        await service.PlaceAsync(
            Organization.MathCompsSlug,
            LeadId,
            await SlotAsync(OctoberBoardId, HostedCompetitionCategory.Elementary, 0), Proposals[13]);

        // It stands there, and problem 1 is gone from the paper
        Assert.Equal(
            [Proposals[13], Proposals[2], Proposals[3], Proposals[4]],
            await DraftSlotsAsync(OctoberBoardId, HostedCompetitionCategory.Elementary));

        // While the spare board still holds both
        Assert.Equal(
            [Proposals[1], Proposals[13], null, null],
            await DraftSlotsAsync(SpareBoardId, HostedCompetitionCategory.Elementary));
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
            Organization.MathCompsSlug,
            LeadId,
            await SlotAsync(OctoberBoardId, HostedCompetitionCategory.Elementary, 0), Proposals[6]);

        // It took problem 1's slot
        Assert.Equal(
            [Proposals[6], Proposals[2], Proposals[3], Proposals[4]],
            await DraftSlotsAsync(OctoberBoardId, HostedCompetitionCategory.Elementary));

        // And problem 1 took its old one
        Assert.Equal(
            [Proposals[5], Proposals[1], Proposals[7], Proposals[8]],
            await DraftSlotsAsync(OctoberBoardId, HostedCompetitionCategory.Intermediate));
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
                Organization.MathCompsSlug,
                LeadId,
                await SlotAsync(SpareBoardId, HostedCompetitionCategory.Elementary, 3), Proposals[1]);

            // Moved, its old slot emptied
            Assert.Equal(
                [null, Proposals[13], null, Proposals[1]],
                await DraftSlotsAsync(SpareBoardId, HostedCompetitionCategory.Elementary));
        });

    /// <summary>
    /// A board and a proposal are each reached through their own organization's selection alone, so neither a write
    /// naming another organization nor a proposal from another pool reaches the board.
    /// </summary>
    [Fact]
    public Task A_placement_stays_inside_one_organization() => RunTestAsync(async service =>
    {
        // The spare board's last elementary slot, which stands empty
        var slot = await SlotAsync(SpareBoardId, HostedCompetitionCategory.Elementary, 3);

        // MathComps' board, reached through the olympiad's selection with the olympiad's own proposal, refused like a
        // board that is not there
        await Assert.ThrowsAsync<SelectionTargetNotFoundException>(
            () => service.PlaceAsync(OlympiadSlug, LeadId, slot, OlympiadProposalId));

        // The olympiad's proposal, placed on MathComps' board, refused like a proposal that is not there
        await Assert.ThrowsAsync<SelectionTargetNotFoundException>(
            () => service.PlaceAsync(Organization.MathCompsSlug, LeadId, slot, OlympiadProposalId));

        // The slot as it stood
        Assert.Equal(
            [Proposals[1], Proposals[13], null, null],
            await DraftSlotsAsync(SpareBoardId, HostedCompetitionCategory.Elementary));
    });

    /// <summary>
    /// Only the leads of a paper's category change its slots, so a member leading none places, moves and empties
    /// nothing, and the paper stays as it stood.
    /// </summary>
    [Fact]
    public Task A_member_who_leads_nothing_changes_no_slot() => RunTestAsync(async service =>
    {
        // The spare board's first elementary slot, which problem 1 holds
        var slot = await SlotAsync(SpareBoardId, HostedCompetitionCategory.Elementary, 0);

        // Problem 14 put there, refused
        await Assert.ThrowsAsync<SelectionNotLeadException>(
            () => service.PlaceAsync(Organization.MathCompsSlug, MemberId, slot, Proposals[14]));

        // The slot moved down, refused
        await Assert.ThrowsAsync<SelectionNotLeadException>(
            () => service.MoveSlotAsync(Organization.MathCompsSlug, MemberId, slot, SlotDirection.Down));

        // The slot emptied, refused
        await Assert.ThrowsAsync<SelectionNotLeadException>(
            () => service.ClearSlotAsync(Organization.MathCompsSlug, MemberId, slot));

        // The paper as it stood
        Assert.Equal(
            [Proposals[1], Proposals[13], null, null],
            await DraftSlotsAsync(SpareBoardId, HostedCompetitionCategory.Elementary));
    });

    /// <summary>
    /// A lead changes their own category's papers alone: the elementary lead fills an elementary slot and is
    /// refused an intermediate one.
    /// </summary>
    [Fact]
    public Task A_lead_changes_their_own_categorys_papers_alone() => RunTestAsync(async service =>
    {
        // Problem 14 into the spare board's last elementary slot
        await service.PlaceAsync(
            Organization.MathCompsSlug,
            ElementaryLeadId,
            await SlotAsync(SpareBoardId, HostedCompetitionCategory.Elementary, 3), Proposals[14]);

        // It stands there
        Assert.Equal(
            [Proposals[1], Proposals[13], null, Proposals[14]],
            await DraftSlotsAsync(SpareBoardId, HostedCompetitionCategory.Elementary));

        // Problem 12 into the spare board's first intermediate slot, refused
        await Assert.ThrowsAsync<SelectionNotLeadException>(async () => await service.PlaceAsync(
            Organization.MathCompsSlug,
            ElementaryLeadId,
            await SlotAsync(SpareBoardId, HostedCompetitionCategory.Intermediate, 0), Proposals[12]));

        // The intermediate paper as empty as it stood
        Assert.Equal(
            [null, null, null, null],
            await DraftSlotsAsync(SpareBoardId, HostedCompetitionCategory.Intermediate));
    });

    /// <summary>
    /// A problem placed from another paper of the board trades places, which changes the paper it leaves too, so a
    /// lead of the slot's category alone is refused it, and neither paper changes.
    /// </summary>
    [Fact]
    public Task A_placement_taking_a_problem_out_of_another_categorys_paper_is_refused() => RunTestAsync(
        async service =>
        {
            // Problem 6, the second intermediate one, into the first elementary slot by the elementary lead, refused
            await Assert.ThrowsAsync<SelectionNotLeadException>(async () => await service.PlaceAsync(
                Organization.MathCompsSlug,
                ElementaryLeadId,
                await SlotAsync(OctoberBoardId, HostedCompetitionCategory.Elementary, 0), Proposals[6]));

            // The elementary paper as it stood
            Assert.Equal(
                [Proposals[1], Proposals[2], Proposals[3], Proposals[4]],
                await DraftSlotsAsync(OctoberBoardId, HostedCompetitionCategory.Elementary));

            // And the intermediate one
            Assert.Equal(
                [Proposals[5], Proposals[6], Proposals[7], Proposals[8]],
                await DraftSlotsAsync(OctoberBoardId, HostedCompetitionCategory.Intermediate));
        });

    /// <summary>
    /// A problem sitting in a hosted round has been taken by a paper, so no draft can take it again.
    /// </summary>
    [Fact]
    public Task A_draft_takes_no_problem_a_paper_has_taken() => RunTestAsync(async service =>
        // Problem 16, which sits in a September round
        await Assert.ThrowsAsync<SelectionProposalUsedException>(async () => await service.PlaceAsync(
            Organization.MathCompsSlug,
            LeadId,
            await SlotAsync(SpareBoardId, HostedCompetitionCategory.Advanced, 0), Proposals[16])));

    /// <summary>
    /// A move trades a slot with its neighbour in the same paper. Both are read before either is written, or the
    /// second write would copy the first and leave one problem standing in both.
    /// </summary>
    [Fact]
    public Task A_move_trades_a_draft_slot_with_its_neighbour() => RunTestAsync(async service =>
    {
        // The spare board's second elementary slot one up
        await service.MoveSlotAsync(
            Organization.MathCompsSlug,
            LeadId,
            await SlotAsync(SpareBoardId, HostedCompetitionCategory.Elementary, 1), SlotDirection.Up);

        // The two traded
        Assert.Equal(
            [Proposals[13], Proposals[1], null, null],
            await DraftSlotsAsync(SpareBoardId, HostedCompetitionCategory.Elementary));
    });

    /// <summary>
    /// A move down from a paper's last slot is refused, there being no neighbour below it. Let through, it would put
    /// the problem in a slot past the paper's end.
    /// </summary>
    [Fact]
    public Task A_move_past_the_end_of_a_paper_is_refused() => RunTestAsync(async service =>
        // The last elementary slot one further down
        await Assert.ThrowsAsync<SelectionTargetNotFoundException>(async () => await service.MoveSlotAsync(
            Organization.MathCompsSlug,
            LeadId,
            await SlotAsync(OctoberBoardId, HostedCompetitionCategory.Elementary, 3), SlotDirection.Down)));

    /// <summary>
    /// A finalized board's slots are its group's rounds, so it takes no placing, moving or emptying.
    /// </summary>
    [Fact]
    public Task A_finalized_board_takes_no_change() => RunTestAsync(async service =>
    {
        // The October board finalized
        await QueryAsync<IBoardFinalizationService>((_, finalization) =>
            finalization.FinalizeAsync(Organization.MathCompsSlug, OctoberBoardId, OctoberId));

        // Its first elementary slot
        var slot = await SlotAsync(OctoberBoardId, HostedCompetitionCategory.Elementary, 0);

        // Problem 13 put there, refused
        await Assert.ThrowsAsync<SelectionBoardFinalizedException>(() => service.PlaceAsync(
            Organization.MathCompsSlug, LeadId, slot, Proposals[13]));

        // The slot moved down, refused
        await Assert.ThrowsAsync<SelectionBoardFinalizedException>(
            () => service.MoveSlotAsync(Organization.MathCompsSlug, LeadId, slot, SlotDirection.Down));

        // The slot emptied, refused
        await Assert.ThrowsAsync<SelectionBoardFinalizedException>(() => service.ClearSlotAsync(
            Organization.MathCompsSlug, LeadId, slot));
    });

    /// <summary>
    /// Once a board's group opens, students are sitting what it holds, so it takes no change.
    /// </summary>
    [Fact]
    public Task A_board_whose_cycle_has_opened_takes_no_change() => RunTestAsync(async service =>
    {
        // The spare board, as though it had been finalized into the September group
        await QueryAsync(async context =>
            await context.SelectionBoards
                .Where(board => board.Id == SpareBoardId)
                .ExecuteUpdateAsync(setters => setters.SetProperty(board => board.HostedGroupId, SeptemberId)));

        // Emptying the spare board's first elementary slot, refused for the opened group
        await Assert.ThrowsAsync<SelectionBoardOpenedException>(async () => await service.ClearSlotAsync(
            Organization.MathCompsSlug,
            LeadId,
            await SlotAsync(SpareBoardId, HostedCompetitionCategory.Elementary, 0)));
    });
}

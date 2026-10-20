using MathComps.Domain.Contracts.Selection;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Organizations;
using Microsoft.EntityFrameworkCore;

namespace MathComps.Infrastructure.Services.Selection;

/// <summary>
/// Implements <see cref="ISelectionBoardService"/> over the database, each change one write through
/// <see cref="SelectionRules.RunWriteAsync"/>. A draft's slots are its <see cref="SelectionSlot"/> rows; a
/// finalized board's are its group's rounds, which none of these changes reaches. The account's lead categories are
/// read before the write waits its turn, since no selection write changes them.
/// </summary>
/// <param name="dbContextFactory">Creates the context each change runs on.</param>
/// <param name="members">Reads which categories the account making a change leads.</param>
public sealed class SelectionBoardService(
    IDbContextFactory<MathCompsDbContext> dbContextFactory,
    IOrganizationMemberService members)
    : ISelectionBoardService
{
    /// <inheritdoc/>
    public async Task PlaceAsync(
        string organizationSlug, Guid userId, SlotAddress slot, Guid proposalId,
        CancellationToken cancellationToken = default)
    {
        // The categories the account leads
        var leadCategoryIds = await members.GetLeadCategoryIdsAsync(userId, organizationSlug, cancellationToken);

        // The placement, as one selection write
        await SelectionRules.RunWriteAsync(dbContextFactory, async dbContext =>
        {
            // The board, which has to be a draft
            var board = await SelectionRules.ReadDraftAsync(
                dbContext, organizationSlug, slot.BoardId, cancellationToken);

            // The paper holding the slot
            var paper = PaperOf(board, slot);

            // Only a lead of the paper's category fills its slot
            RequireLead(paper, leadCategoryIds);

            // The proposal going in, from the same organization's pool as the board
            var proposal = await SelectionRules.ReadProposalAsync(
                dbContext, organizationSlug, proposalId, cancellationToken);

            // A draft takes only what is still in the pool
            if (!SelectionRules.IsInPool(proposal.Problem.Round.Competition.Path))
                throw new SelectionProposalUsedException();

            // Where else on this board the problem already stands, if anywhere
            var source = board.Papers
                .SelectMany(candidate => candidate.Slots)
                .FirstOrDefault(candidate => candidate.ProblemId == proposal.ProblemId
                    && (candidate.PaperId != paper.Id || candidate.Position != slot.Index));

            // The paper the problem leaves changes too, so only a lead of its category moves the problem out
            if (source is not null)
                RequireLead(source.Paper, leadCategoryIds);

            // What stands in the slot now, read before anything moves
            var occupant = ProblemIdAt(paper, slot.Index);

            // The problem takes the slot
            SetSlot(dbContext, paper, slot.Index, proposal.ProblemId);

            // The problem's old slot on the board, if any, takes what stood in the new one
            if (source is not null)
                SetSlot(dbContext, source.Paper, source.Position, occupant);
        }, cancellationToken);
    }

    /// <inheritdoc/>
    public async Task ClearSlotAsync(
        string organizationSlug, Guid userId, SlotAddress slot, CancellationToken cancellationToken = default)
    {
        // The categories the account leads
        var leadCategoryIds = await members.GetLeadCategoryIdsAsync(userId, organizationSlug, cancellationToken);

        // The clearing, as one selection write
        await SelectionRules.RunWriteAsync(dbContextFactory, async dbContext =>
        {
            // The board, which has to be a draft
            var board = await SelectionRules.ReadDraftAsync(
                dbContext, organizationSlug, slot.BoardId, cancellationToken);

            // The paper holding the slot
            var paper = PaperOf(board, slot);

            // Only a lead of the paper's category empties its slot
            RequireLead(paper, leadCategoryIds);

            // The slot emptied, its problem back in the pool
            SetSlot(dbContext, paper, slot.Index, null);
        }, cancellationToken);
    }

    /// <inheritdoc/>
    public async Task MoveSlotAsync(
        string organizationSlug, Guid userId, SlotAddress slot, SlotDirection direction,
        CancellationToken cancellationToken = default)
    {
        // The categories the account leads
        var leadCategoryIds = await members.GetLeadCategoryIdsAsync(userId, organizationSlug, cancellationToken);

        // The trade, as one selection write
        await SelectionRules.RunWriteAsync(dbContextFactory, async dbContext =>
        {
            // The board, which has to be a draft
            var board = await SelectionRules.ReadDraftAsync(
                dbContext, organizationSlug, slot.BoardId, cancellationToken);

            // The paper holding the slot
            var paper = PaperOf(board, slot);

            // Only a lead of the paper's category reorders its slots
            RequireLead(paper, leadCategoryIds);

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

            // What stands in each of the two slots, read before either changes
            var here = ProblemIdAt(paper, slot.Index);
            var there = ProblemIdAt(paper, neighbour);

            // Each slot takes what the other held
            SetSlot(dbContext, paper, slot.Index, there);
            SetSlot(dbContext, paper, neighbour, here);
        }, cancellationToken);
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
    /// Refuses a change to a paper unless the account making it leads the paper's category.
    /// </summary>
    /// <param name="paper">The paper, with its category's id.</param>
    /// <param name="leadCategoryIds">The ids of the categories the account leads.</param>
    /// <exception cref="SelectionNotLeadException">
    /// Thrown when the account does not lead the paper's category, or the paper has none and so no leads.
    /// </exception>
    private static void RequireLead(SelectionPaper paper, IReadOnlySet<Guid> leadCategoryIds)
    {
        // A paper outside the categories has no leads, and any other paper only its own category's
        if (paper.CategoryId is not { } categoryId || !leadCategoryIds.Contains(categoryId))
            throw new SelectionNotLeadException();
    }

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

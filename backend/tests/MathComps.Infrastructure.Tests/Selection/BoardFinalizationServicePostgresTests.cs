using MathComps.Domain.Contracts.Competitions;
using MathComps.Domain.EfCoreEntities;
using MathComps.Domain.Localization;
using MathComps.Infrastructure.Services.Problems;
using MathComps.Infrastructure.Services.Selection;
using MathComps.Infrastructure.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;

namespace MathComps.Infrastructure.Tests.Selection;

/// <summary>
/// Covers <see cref="BoardFinalizationService"/>: moving a board's papers into a hosted group's rounds, refusing a
/// board or a problem that cannot go in, and keeping every other organization's board out of the groups.
/// </summary>
/// <param name="fixture">The shared PostgreSQL container fixture.</param>
public class BoardFinalizationServicePostgresTests(PostgresContainerFixture fixture)
    : SelectionBoardPostgresTestBase<IBoardFinalizationService>(fixture)
{
    /// <summary>
    /// Finalizing moves each paper's problems into the round of its category's hosted level, in slot order and with
    /// the slugs those positions call for. The board is then tied to the group, its slot rows gone, and the problems
    /// leave every draft they still stood on.
    /// </summary>
    [Fact]
    public Task Finalizing_moves_the_papers_into_the_cycles_rounds() => RunTestAsync(async service =>
    {
        // The October board into the October group
        await service.FinalizeAsync(Organization.MathCompsSlug, OctoberBoardId, OctoberId);

        // The first elementary problem sits first in the elementary round, on the slug that position calls for
        Assert.Equal(
            ("mathcomps-elementary-october", 1, "76-mathcomps-elementary-october-1"),
            await PositionOfAsync(Proposals[1]));

        // And the last advanced one last in the advanced round
        Assert.Equal(
            ("mathcomps-advanced-october", 4, "76-mathcomps-advanced-october-4"),
            await PositionOfAsync(Proposals[12]));

        // The board's group, and how many slot rows its papers still hold
        var board = await QueryValueAsync(context => context.SelectionBoards
            .Where(candidate => candidate.Id == OctoberBoardId)
            .Select(candidate => new
            {
                candidate.HostedGroupId,
                Slots = candidate.Papers.SelectMany(paper => paper.Slots).Count(),
            })
            .SingleAsync());

        // Tied to the October group
        Assert.Equal(OctoberId, board.HostedGroupId);

        // With no slot rows left
        Assert.Equal(0, board.Slots);

        // And the spare board lost problem 1, keeping problem 13
        Assert.Equal(
            [null, Proposals[13], null, null],
            await DraftSlotsAsync(SpareBoardId, HostedCompetitionCategory.Elementary));
    });

    /// <summary>
    /// A round is either empty or full, so a board with one slot emptied cannot be finalized.
    /// </summary>
    [Fact]
    public Task Finalizing_a_board_with_an_empty_slot_is_refused() => RunTestAsync(async service =>
    {
        // The October board's last elementary slot
        var slot = await SlotAsync(OctoberBoardId, HostedCompetitionCategory.Elementary, 3);

        // The slot emptied
        await QueryAsync<ISelectionBoardService>((_, boards) =>
            boards.ClearSlotAsync(Organization.MathCompsSlug, LeadId, slot));

        // Problem 4 back in the pool, the rest of the paper standing
        Assert.Equal(
            [Proposals[1], Proposals[2], Proposals[3], null],
            await DraftSlotsAsync(OctoberBoardId, HostedCompetitionCategory.Elementary));

        // So the board no longer fills the group
        await Assert.ThrowsAsync<SelectionFinalizeBlockedException>(
            () => service.FinalizeAsync(Organization.MathCompsSlug, OctoberBoardId, OctoberId));

        // And nothing moved
        Assert.Equal(ProposalsRoundId, await RoundOfAsync(Proposals[1]));
    });

    /// <summary>
    /// A group that has opened is being sat, so no board goes into it, even one whose rounds nothing filled.
    /// </summary>
    [Fact]
    public Task Finalizing_into_an_opened_cycle_is_refused() => RunTestAsync(async service =>
    {
        // The November group opened an hour ago, its rounds still empty
        await QueryAsync(async context =>
            await context.HostedGroups
                .Where(group => group.Id == NovemberId)
                .ExecuteUpdateAsync(setters => setters.SetProperty(
                    group => group.OpensAt, DateTimeOffset.UtcNow.AddHours(-1))));

        // The full October board into it
        await Assert.ThrowsAsync<SelectionFinalizeBlockedException>(
            () => service.FinalizeAsync(Organization.MathCompsSlug, OctoberBoardId, NovemberId));

        // And nothing moved
        Assert.Equal(ProposalsRoundId, await RoundOfAsync(Proposals[1]));
    });

    /// <summary>
    /// Every paper has to fill the round of its category's hosted level, so a paper whose category is no hosted
    /// level leaves a round with nothing to fill it.
    /// </summary>
    [Fact]
    public Task Finalizing_a_paper_no_round_fits_is_refused() => RunTestAsync(async service =>
    {
        // The advanced category made one no hosted round runs
        await QueryAsync(async context =>
            await context.OrganizationCategories
                .Where(category => category.Name == "advanced")
                .ExecuteUpdateAsync(setters =>
                    setters.SetProperty(category => category.HostedCategory, (HostedCompetitionCategory?)null)));

        // So it pairs with no round
        await Assert.ThrowsAsync<SelectionFinalizeBlockedException>(
            () => service.FinalizeAsync(Organization.MathCompsSlug, OctoberBoardId, OctoberId));
    });

    /// <summary>
    /// A round holds exactly the number of problems its group announces, so a paper of any other length would
    /// leave it short or over, which the competitions page cannot serve.
    /// </summary>
    [Fact]
    public Task Finalizing_a_paper_longer_than_the_cycles_is_refused() => RunTestAsync(async service =>
    {
        // The October board's elementary paper
        var paperId = await PaperIdAsync(OctoberBoardId, HostedCompetitionCategory.Elementary);

        // Grown to five slots, the fifth filled too
        await QueryAsync(async context =>
        {
            // The fifth slot
            await context.SelectionPapers
                .Where(paper => paper.Id == paperId)
                .ExecuteUpdateAsync(setters => setters.SetProperty(paper => paper.SlotCount, 5));

            // Problem 13 in it
            context.SelectionSlots.Add(
                new SelectionSlot { PaperId = paperId, Position = 4, ProblemId = Proposals[13] });

            // Written
            await context.SaveChangesAsync();
        });

        // Refused
        await Assert.ThrowsAsync<SelectionFinalizeBlockedException>(
            () => service.FinalizeAsync(Organization.MathCompsSlug, OctoberBoardId, OctoberId));
    });

    /// <summary>
    /// A round serves every language the site is read in, so a problem written in fewer cannot go into one.
    /// </summary>
    [Fact]
    public Task Finalizing_a_problem_missing_a_language_is_refused() => RunTestAsync(async service =>
    {
        // Problem 15, written in English alone, in place of problem 4
        await SetDraftSlotAsync(OctoberBoardId, HostedCompetitionCategory.Elementary, 3, Proposals[15]);

        // Refused
        await Assert.ThrowsAsync<SelectionProblemIncompleteException>(
            () => service.FinalizeAsync(Organization.MathCompsSlug, OctoberBoardId, OctoberId));

        // With nothing moved
        Assert.Equal(ProposalsRoundId, await RoundOfAsync(Proposals[1]));
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
            await context.ProblemTexts
                .Where(text => text.ProblemId == Proposals[4]
                    && text.DocumentType == DocumentType.Solution
                    && text.Language == Language.CS)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(text => text.MarkdownText, " ")
                    .SetProperty(text => text.RawText, (string?)null)));

        // Refused like a missing one
        await Assert.ThrowsAsync<SelectionProblemIncompleteException>(
            () => service.FinalizeAsync(Organization.MathCompsSlug, OctoberBoardId, OctoberId));
    });

    /// <summary>
    /// Finalize checks every slotted problem is still in the pool, however the draft came to hold one that is not.
    /// </summary>
    [Fact]
    public Task Finalizing_a_problem_a_paper_has_since_taken_is_refused() => RunTestAsync(async service =>
    {
        // Problem 16, sitting in a September round, in place of problem 4
        await SetDraftSlotAsync(OctoberBoardId, HostedCompetitionCategory.Elementary, 3, Proposals[16]);

        // Refused
        await Assert.ThrowsAsync<SelectionProposalUsedException>(
            () => service.FinalizeAsync(Organization.MathCompsSlug, OctoberBoardId, OctoberId));
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
            await context.Problems
                .Where(problem => problem.Id == Proposals[14])
                .ExecuteUpdateAsync(setters =>
                    setters.SetProperty(problem => problem.Slug, "76-mathcomps-elementary-october-1")));

        // The October board, whose first elementary problem needs that slug
        await Assert.ThrowsAsync<ProblemSlugTakenException>(
            () => service.FinalizeAsync(Organization.MathCompsSlug, OctoberBoardId, OctoberId));

        // With nothing moved
        Assert.Equal(ProposalsRoundId, await RoundOfAsync(Proposals[1]));
    });

    /// <summary>
    /// The hosted groups take MathComps' boards alone, so another organization finalizes no board, its own or
    /// MathComps'. Either is refused like a board that is not there, and nothing moves.
    /// </summary>
    [Fact]
    public Task Another_organization_finalizes_no_board() => RunTestAsync(async service =>
    {
        // The olympiad's own board into the October group, refused
        await Assert.ThrowsAsync<SelectionTargetNotFoundException>(
            () => service.FinalizeAsync(OlympiadSlug, OlympiadBoardId, OctoberId));

        // MathComps' October board through the olympiad, refused too
        await Assert.ThrowsAsync<SelectionTargetNotFoundException>(
            () => service.FinalizeAsync(OlympiadSlug, OctoberBoardId, OctoberId));

        // The olympiad's proposal still in the pool
        Assert.Equal(ProposalsRoundId, await RoundOfAsync(OlympiadProposalId));

        // And so is MathComps' first
        Assert.Equal(ProposalsRoundId, await RoundOfAsync(Proposals[1]));
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
        await service.FinalizeAsync(Organization.MathCompsSlug, OctoberBoardId, OctoberId);

        // Finalizing the October board into the November group, refused
        await Assert.ThrowsAsync<SelectionBoardFinalizedException>(
            () => service.FinalizeAsync(Organization.MathCompsSlug, OctoberBoardId, NovemberId));
    });

    /// <summary>
    /// Puts a problem straight into a draft's slot row, standing in for a board the service never built.
    /// </summary>
    /// <param name="boardId">The board.</param>
    /// <param name="level">The hosted level the paper's category is.</param>
    /// <param name="index">The slot, from zero.</param>
    /// <param name="problemId">The problem.</param>
    /// <returns>A task that completes once the row is written.</returns>
    private async Task SetDraftSlotAsync(
        Guid boardId, HostedCompetitionCategory level, int index, Guid problemId)
    {
        // The paper holding the slot
        var paperId = await PaperIdAsync(boardId, level);

        // The row repointed
        await QueryAsync(async context =>
            await context.SelectionSlots
                .Where(slot => slot.PaperId == paperId && slot.Position == index)
                .ExecuteUpdateAsync(setters => setters.SetProperty(slot => slot.ProblemId, problemId)));
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

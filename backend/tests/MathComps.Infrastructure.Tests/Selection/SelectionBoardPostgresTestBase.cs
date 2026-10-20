using MathComps.Domain.Contracts.Competitions;
using MathComps.Domain.Localization;
using MathComps.Infrastructure.Extensions;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Selection;
using MathComps.Infrastructure.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace MathComps.Infrastructure.Tests.Selection;

/// <summary>
/// A base for the suites over the selection's boards against a real PostgreSQL database, with the selection's
/// services registered and one seed of proposals, hosted groups and boards the suites share.
/// </summary>
/// <remarks>
/// The seed is sixteen of MathComps' proposals, the October and November groups not yet open with empty rounds, a
/// September group already open, the full October board and a part-filled spare one sharing problem 1 with it.
/// Problem 15 is written in English alone, and problem 16 sits in a September round rather than in the pool. The
/// olympiad has one proposal of its own in the same pool, on a board of its own.
/// </remarks>
/// <typeparam name="TService">The service the derived suite tests.</typeparam>
/// <param name="fixture">The shared PostgreSQL container fixture.</param>
public abstract class SelectionBoardPostgresTestBase<TService>(PostgresContainerFixture fixture)
    : PostgresTestBase<TService>(fixture) where TService : class
{
    /// <summary>
    /// The slug of the olympiad, the organization beside MathComps.
    /// </summary>
    protected const string OlympiadSlug = "olympiad";

    /// <summary>
    /// The proposals by their number.
    /// </summary>
    protected Dictionary<int, Guid> Proposals { get; } = [];

    /// <summary>
    /// The olympiad's one proposal, in the pool beside MathComps' own.
    /// </summary>
    protected Guid OlympiadProposalId { get; private set; }

    /// <summary>
    /// The olympiad's board, its one paper holding the olympiad's proposal.
    /// </summary>
    protected Guid OlympiadBoardId { get; private set; }

    /// <summary>
    /// The round the pool's problems are parked in.
    /// </summary>
    protected Guid ProposalsRoundId { get; private set; }

    /// <summary>
    /// The October group, not yet open, its rounds empty.
    /// </summary>
    protected Guid OctoberId { get; private set; }

    /// <summary>
    /// The November group, not yet open, its rounds empty.
    /// </summary>
    protected Guid NovemberId { get; private set; }

    /// <summary>
    /// The September group, already open.
    /// </summary>
    protected Guid SeptemberId { get; private set; }

    /// <summary>
    /// The October board: problems 1 to 12, four a paper.
    /// </summary>
    protected Guid OctoberBoardId { get; private set; }

    /// <summary>
    /// A spare board: problem 1, then 13, in its elementary paper, everything else empty.
    /// </summary>
    protected Guid SpareBoardId { get; private set; }

    /// <inheritdoc/>
    protected override void ConfigureServices(IServiceCollection services) =>
        // The service under test, with the rest of the selection.
        services.AddProblemSelectionServices();

    /// <inheritdoc/>
    protected override async Task SeedDataAsync(MathCompsDbContext context)
    {
        // The season every round sits in
        var season = SelectionSeed.NewSeason(context);

        // The pool's round
        var pool = SelectionSeed.NewProposalsRound(context, season);
        ProposalsRoundId = pool.Id;

        // Fourteen problems written in every language
        foreach (var number in Enumerable.Range(1, 14))
            Proposals[number] = SelectionSeed.NewProposal(context, pool, number, number);

        // Problem 15, written in English alone
        Proposals[15] = SelectionSeed.NewProposal(context, pool, 15, 15, Language.EN);

        // The olympiad, listing a category of its own
        var olympiadId = SelectionSeed.NewOrganization(context, OlympiadSlug, "C");

        // Its proposal, in the same round
        OlympiadProposalId = SelectionSeed.NewProposal(context, olympiadId, pool, 1, 20);

        // Its board, holding the proposal
        OlympiadBoardId = SelectionSeed.NewBoard(context, olympiadId, "Olympiad", OlympiadProposalId).Id;

        // The instant every group's opening is set against
        var now = DateTimeOffset.UtcNow;

        // The groups a board can go into
        OctoberId = SelectionSeed.NewGroup(context, season, "october", now.AddDays(10)).Id;
        NovemberId = SelectionSeed.NewGroup(context, season, "november", now.AddDays(40)).Id;

        // The September group, already open
        var september = SelectionSeed.NewGroup(context, season, "september", now.AddDays(-1));
        SeptemberId = september.Id;

        // Problem 16, sitting in a September round
        Proposals[16] = SelectionSeed.NewProposal(context, september.Rounds.First(), 16, 1);

        // The October board, full
        OctoberBoardId = SelectionSeed.NewBoard(
            context, "October", [.. Enumerable.Range(1, 12).Select(number => (Guid?)Proposals[number])]).Id;

        // The spare board, sharing problem 1
        SpareBoardId = SelectionSeed.NewBoard(context, "Spare", Proposals[1], Proposals[13]).Id;

        // Written
        await context.SaveChangesAsync();
    }

    /// <summary>
    /// Addresses one slot of a board's paper at a hosted level.
    /// </summary>
    /// <param name="boardId">The board.</param>
    /// <param name="level">The hosted level the paper's category is.</param>
    /// <param name="index">The slot, from zero.</param>
    /// <returns>The slot's address.</returns>
    protected async Task<SlotAddress> SlotAsync(Guid boardId, HostedCompetitionCategory level, int index) =>
        // The address, naming the board's paper at that level
        new(boardId, await PaperIdAsync(boardId, level), index);

    /// <summary>
    /// Reads the id of a board's paper at a hosted level.
    /// </summary>
    /// <param name="boardId">The board.</param>
    /// <param name="level">The hosted level the paper's category is.</param>
    /// <returns>The paper's id.</returns>
    protected Task<Guid> PaperIdAsync(Guid boardId, HostedCompetitionCategory level) =>
        // The board's one paper of a category at that level
        QueryValueAsync(context => context.SelectionPapers
            .Where(paper => paper.BoardId == boardId && paper.Category!.HostedCategory == level)
            .Select(paper => paper.Id)
            .SingleAsync());

    /// <summary>
    /// Reads what stands in each slot of a draft's paper at a hosted level.
    /// </summary>
    /// <param name="boardId">The board.</param>
    /// <param name="level">The hosted level the paper's category is.</param>
    /// <returns>The problem in each slot, null where it stands empty.</returns>
    protected async Task<IReadOnlyList<Guid?>> DraftSlotsAsync(Guid boardId, HostedCompetitionCategory level)
    {
        // The board's paper at that level
        var paperId = await PaperIdAsync(boardId, level);

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
}

using MathComps.Domain.Contracts.Competitions;
using MathComps.Domain.EfCoreEntities;
using MathComps.Domain.Localization;
using MathComps.Infrastructure.Extensions;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Localization;
using MathComps.Infrastructure.Services.Selection;
using MathComps.Infrastructure.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace MathComps.Infrastructure.Tests.Selection;

/// <summary>
/// Covers <see cref="ProblemSelectionService"/>: the field mapping of the one read, and which proposals, boards
/// and cycles it holds once groups open.
/// </summary>
/// <remarks>
/// The seed is a pool of three proposals with a draft holding one. The October group has not opened and its
/// rounds are empty. The November group has not opened either, and has a board finalized into it. The September
/// group has opened, with a board finalized into it too. Each finalized board's problems sit in its group's rounds.
/// </remarks>
/// <param name="fixture">The shared PostgreSQL container fixture.</param>
public class ProblemSelectionServicePostgresTests(PostgresContainerFixture fixture)
    : PostgresTestBase<IProblemSelectionService>(fixture)
{
    /// <summary>
    /// A reviewer whose account is live.
    /// </summary>
    private readonly Guid _reviewerId = Guid.CreateVersion7();

    /// <summary>
    /// A reviewer whose account is deleted.
    /// </summary>
    private readonly Guid _goneReviewerId = Guid.CreateVersion7();

    /// <summary>
    /// The pool's proposals by their number. The first is filed, set aside, written in two languages and talked
    /// about; the third is deleted.
    /// </summary>
    private readonly Dictionary<int, Guid> _pool = [];

    /// <summary>
    /// The November group's problems, round by round in the order the categories run.
    /// </summary>
    private readonly List<Guid> _november = [];

    /// <summary>
    /// A problem of the opened September group, with a conversation and a comment of its own.
    /// </summary>
    private Guid _openedId;

    /// <summary>
    /// The October group, which still takes a board.
    /// </summary>
    private Guid _octoberId;

    /// <summary>
    /// The board finalized into the November group.
    /// </summary>
    private Guid _novemberBoardId;

    /// <inheritdoc/>
    protected override void ConfigureServices(IServiceCollection services) =>
        // The service under test, with the rest of the selection.
        services.AddProblemSelectionServices();

    /// <summary>
    /// A proposal reads with its filing and with a text for every language it has a statement in: the solution
    /// where one is written and null where not, and the hints split into the ladder.
    /// </summary>
    [Fact]
    public Task A_proposal_reads_with_its_filing_and_its_texts() => RunTestAsync(async service =>
    {
        // The selection
        var selection = await service.GetSelectionAsync(Language.EN);

        // The first proposal
        var proposal = selection.Proposals.Single(candidate => candidate.Id == _pool[1]);

        // Filed the way it was seeded
        Assert.Equal(
            (1, "Proposal 1", ProposalArea.Geometry, true, false),
            (proposal.Number, proposal.Title, proposal.Area, proposal.IsSetAside, proposal.IsUsed));
        Assert.Equal(
            [HostedCompetitionCategory.Elementary, HostedCompetitionCategory.Advanced],
            proposal.Recommended);

        // A text in English and Slovak, the two it has statements in
        Assert.Equal([Language.SK, Language.EN], proposal.Texts.Keys.Order());

        // The English text
        var english = proposal.Texts[Language.EN];

        // The English statement, solution and two hints
        Assert.Equal(("Statement 1 in EN", "Solution 1 in EN"), (english.Statement, english.Solution));
        Assert.Equal(["Nudge", "Push"], english.Hints);

        // The Slovak text
        var slovak = proposal.Texts[Language.SK];

        // The Slovak statement, with no solution and no hints
        Assert.Equal("Statement 1 in SK", slovak.Statement);
        Assert.Null(slovak.Solution);
        Assert.Empty(slovak.Hints);
    });

    /// <summary>
    /// A draft reads its slot rows laid out over its papers, each in its own position and an empty slot as null.
    /// An empty slot has no row, so a read that listed the rows as they come would slide the problem into the
    /// first slot.
    /// </summary>
    [Fact]
    public Task A_draft_reads_its_slots_in_place() => RunTestAsync(async service =>
    {
        // The selection
        var selection = await service.GetSelectionAsync(Language.EN);

        // The draft
        var board = selection.Boards.Single(candidate => candidate.Finalization is null);

        // The draft's one problem, in the elementary paper's second slot
        Assert.Equal([null, _pool[2], null, null], board.Papers[0].Slots);

        // And its other papers empty
        Assert.All(board.Papers.Skip(1), paper => Assert.Equal([null, null, null, null], paper.Slots));
    });

    /// <summary>
    /// A finalized board whose group has not opened reads its slots off the group's rounds, in round order, and
    /// its problems count as used. A finalized board keeps no slot rows, so a read that took its slots from them
    /// would show it empty.
    /// </summary>
    [Fact]
    public Task A_finalized_board_reads_its_slots_off_its_rounds() => RunTestAsync(async service =>
    {
        // The selection
        var selection = await service.GetSelectionAsync(Language.EN);

        // The November board
        var board = selection.Boards.Single(candidate => candidate.Id == _novemberBoardId);

        // The board's papers holding the rounds' problems
        Assert.Equal(
            _november.Select(problemId => (Guid?)problemId),
            board.Papers.SelectMany(paper => paper.Slots));

        // Read as finalized
        Assert.NotNull(board.Finalization);

        // And its problems are still in the selection, the only ones used
        Assert.Equal(
            _november.Order(),
            selection.Proposals.Where(proposal => proposal.IsUsed).Select(proposal => proposal.Id).Order());
    });

    /// <summary>
    /// Once a group opens, the board finalized into it leaves the selection, and its problems leave with
    /// everything said about them.
    /// </summary>
    [Fact]
    public Task An_opened_board_leaves_the_selection_with_its_problems() => RunTestAsync(async service =>
    {
        // The selection
        var selection = await service.GetSelectionAsync(Language.EN);

        // Two boards left: the November one and the draft
        Assert.Equal(2, selection.Boards.Count);

        // The September problem gone from the proposals
        Assert.DoesNotContain(selection.Proposals, proposal => proposal.Id == _openedId);

        // The September problem's conversation and comment are gone with it
        Assert.DoesNotContain(selection.Conversations, conversation => conversation.ProposalId == _openedId);
        Assert.False(selection.Comments.ContainsKey(_openedId));
    });

    /// <summary>
    /// A deleted proposal is gone from the read. A delete keeps the row under a stamp, so the read's own filter is
    /// all that keeps it out.
    /// </summary>
    [Fact]
    public Task A_deleted_proposal_is_gone_from_the_read() => RunTestAsync(async service =>
    {
        // The selection
        var selection = await service.GetSelectionAsync(Language.EN);

        // Without the third proposal
        Assert.DoesNotContain(selection.Proposals, proposal => proposal.Id == _pool[3]);
    });

    /// <summary>
    /// The cycles are the groups still taking a board: not the opened one, nor one already filled. Each carries
    /// its categories in the order the taxonomy sets them out, and its name in the language asked for.
    /// </summary>
    [Fact]
    public Task The_cycles_are_the_groups_still_taking_a_board() => RunTestAsync(async service =>
    {
        // The selection, read in Slovak
        var selection = await service.GetSelectionAsync(Language.SK);

        // October alone
        var cycle = Assert.Single(selection.Cycles);
        Assert.Equal(_octoberId, cycle.Id);

        // With every category, and how many problems each paper asks
        Assert.Equal(
            [HostedCompetitionCategory.Elementary, HostedCompetitionCategory.Intermediate,
                HostedCompetitionCategory.Advanced],
            cycle.Categories);
        Assert.Equal(4, cycle.ProblemCount);

        // Named in Slovak
        await QueryAsync<IMetadataLocalizationService>((_, localization) =>
        {
            // The name the taxonomy gives its first round's node
            Assert.Equal(
                localization.GetNodeShortName(Language.SK, SelectionSeed.RoundPaths("october")[0]),
                cycle.Name);

            // Nothing further to check
            return Task.CompletedTask;
        });
    });

    /// <summary>
    /// A group whose rounds are filled one at a time is no cycle once any of them holds a problem, since a board
    /// fills every round of a group at once.
    /// </summary>
    [Fact]
    public Task A_group_with_one_round_filled_is_no_cycle() => RunTestAsync(async service =>
    {
        // One problem in one of October's rounds, the others still empty
        await QueryAsync(async context =>
        {
            // Any one of October's rounds
            var round = await context.Rounds.FirstAsync(candidate => candidate.HostedGroupId == _octoberId);

            // A problem in that round
            SelectionSeed.NewProposal(context, round, 300, 1);

            // Written
            await context.SaveChangesAsync();
        });

        // The selection
        var selection = await service.GetSelectionAsync(Language.EN);

        // So no group takes a board
        Assert.Empty(selection.Cycles);
    });

    /// <summary>
    /// Conversations read newest first with their turns in order; comments read oldest first, live ones only.
    /// Either one's author is their username, and nobody once their account is deleted. A deleted account keeps
    /// its username, so a read that skipped the check would still sign the deleted reviewer's words.
    /// </summary>
    [Fact]
    public Task Conversations_and_comments_read_with_their_authors() => RunTestAsync(async service =>
    {
        // The selection
        var selection = await service.GetSelectionAsync(Language.EN);

        // The first proposal's conversations
        var conversations = selection.Conversations
            .Where(conversation => conversation.ProposalId == _pool[1])
            .ToList();

        // Newest first, the deleted reviewer's unsigned
        Assert.Equal(
            [("Reviewer", "Statement 1 in EN"), (null, "Older statement")],
            conversations.Select(conversation => (conversation.Author, conversation.SavedStatement)));

        // The newer one's turns in the order they were said
        Assert.Equal(
            ["First", "Second"],
            conversations.First().Turns.Select(turn => turn.Content));

        // The first proposal's live comments, oldest first, the deleted reviewer's unsigned
        Assert.Equal(
            [("Reviewer", "Earlier"), (null, "Later")],
            selection.Comments[_pool[1]].Select(comment => (comment.Author, comment.Content)));
    });

    /// <inheritdoc/>
    protected override async Task SeedDataAsync(MathCompsDbContext context)
    {
        // The reviewer whose account is live
        context.Users.Add(HostedSeed.NewUser(_reviewerId, "Reviewer"));

        // And the one whose account is deleted
        var gone = HostedSeed.NewUser(_goneReviewerId, "Gone");
        gone.IsDeleted = true;
        context.Users.Add(gone);

        // The season every round sits in
        var season = SelectionSeed.NewSeason(context);

        // The pool
        var pool = SelectionSeed.NewProposalsRound(context, season);

        // The first proposal, filed, set aside and written in two languages
        _pool[1] = SeedFiledProposal(context, pool);

        // The second, plain, which the draft holds
        _pool[2] = SelectionSeed.NewProposal(context, pool, 2, 2);

        // The third, deleted
        _pool[3] = SelectionSeed.NewProposal(context, pool, 3, 3);
        context.Proposals.Local.Single(proposal => proposal.ProblemId == _pool[3]).DeletedAt = DateTimeOffset.UtcNow;

        // The instant the groups, conversations and comments are dated from
        var now = DateTimeOffset.UtcNow;

        // October, still taking a board
        _octoberId = SelectionSeed.NewGroup(context, season, "october", now.AddDays(10)).Id;

        // November, not yet open
        var november = SelectionSeed.NewGroup(context, season, "november", now.AddDays(40));

        // November's rounds full, four problems each
        foreach (var round in november.Rounds.ToList())
            foreach (var position in Enumerable.Range(1, 4))
                _november.Add(SelectionSeed.NewProposal(context, round, 100 + _november.Count, position));

        // A board finalized into November
        _novemberBoardId = SeedFinalizedBoard(context, november);

        // September, already open
        var september = SelectionSeed.NewGroup(context, season, "september", now.AddDays(-1));

        // One problem in September's first round
        _openedId = SelectionSeed.NewProposal(context, september.Rounds.First(), 200, 1);

        // A board finalized into September
        SeedFinalizedBoard(context, september);

        // A conversation about the September problem
        SeedConversation(context, _openedId, _reviewerId, "Statement", now, "Turn");

        // And a comment under the September problem
        SeedComment(context, _openedId, _reviewerId, "About September", now, CommentStatus.Active);

        // A draft holding the second proposal in its second slot
        SelectionSeed.NewBoard(context, "Draft", null, _pool[2]);

        // The first proposal's two conversations, the older one by the deleted reviewer
        SeedConversation(context, _pool[1], _goneReviewerId, "Older statement", now.AddDays(-2), "Old");
        SeedConversation(context, _pool[1], _reviewerId, "Statement 1 in EN", now.AddDays(-1), "First", "Second");

        // And its comments: two live ones, one deleted, one replaced by an edit
        SeedComment(context, _pool[1], _reviewerId, "Earlier", now.AddHours(-3), CommentStatus.Active);
        SeedComment(context, _pool[1], _goneReviewerId, "Later", now.AddHours(-1), CommentStatus.Active);
        SeedComment(context, _pool[1], _reviewerId, "Deleted", now.AddHours(-2), CommentStatus.Deleted);
        SeedComment(context, _pool[1], _reviewerId, "Superseded", now.AddHours(-2), CommentStatus.Superseded);

        // Written
        await context.SaveChangesAsync();
    }

    /// <summary>
    /// Tracks the first proposal: filed under geometry, recommended for two categories, set aside, with an English
    /// statement, solution and hints, and a Slovak statement alone.
    /// </summary>
    /// <param name="context">The seeding context.</param>
    /// <param name="pool">The pool's round.</param>
    /// <returns>Its id.</returns>
    private static Guid SeedFiledProposal(MathCompsDbContext context, Round pool)
    {
        // The problem with an English statement and solution, filed in the pool
        var problemId = SelectionSeed.NewProposal(context, pool, 1, 1, Language.EN);

        // A Slovak statement with no solution beside it
        context.ProblemTexts.Add(SelectionSeed.NewText(problemId, DocumentType.Statement, Language.SK, 1));

        // An English ladder of two hints
        var hints = SelectionSeed.NewText(problemId, DocumentType.Hints, Language.EN, 1);
        hints.MarkdownText = HintsDocument.Join(["Nudge", "Push"]);
        context.ProblemTexts.Add(hints);

        // Its filing
        var proposal = context.Proposals.Local.Single(candidate => candidate.ProblemId == problemId);
        proposal.Area = ProposalArea.Geometry;
        proposal.Recommended = [HostedCompetitionCategory.Elementary, HostedCompetitionCategory.Advanced];
        proposal.IsSetAside = true;

        // The id
        return problemId;
    }

    /// <summary>
    /// Tracks a board finalized into a group: one paper per category of four slots, its slots the group's rounds.
    /// </summary>
    /// <param name="context">The seeding context.</param>
    /// <param name="group">The group.</param>
    /// <returns>The board's id.</returns>
    private static Guid SeedFinalizedBoard(MathCompsDbContext context, HostedGroup group)
    {
        // A board with empty papers
        var board = SelectionSeed.NewBoard(context, group.Slug);

        // Tied to the group
        board.HostedGroupId = group.Id;

        // The id
        return board.Id;
    }

    /// <summary>
    /// Tracks a conversation about a problem with the turns given, in order.
    /// </summary>
    /// <param name="context">The seeding context.</param>
    /// <param name="problemId">The problem.</param>
    /// <param name="userId">Who held the conversation.</param>
    /// <param name="statement">The statement the conversation was argued on.</param>
    /// <param name="createdAt">When the conversation started.</param>
    /// <param name="turns">What was said, in order.</param>
    private static void SeedConversation(
        MathCompsDbContext context, Guid problemId, Guid userId, string statement, DateTimeOffset createdAt,
        params string[] turns)
    {
        // The session
        var sessionId = Guid.CreateVersion7();
        context.DefenseSessions.Add(new DefenseSession
        {
            Id = sessionId,
            UserId = userId,
            TargetKind = DefenseTargetKind.Problem,
            ProblemStatement = statement,
            ProblemReference = "Reference",
            ExaminerConfig = "{}",
            CreatedAt = createdAt,
        });

        // What it is about
        context.ProblemDefenses.Add(new ProblemDefense { DefenseSessionId = sessionId, ProblemId = problemId });

        // The session's turns, written last first so the order can't come from how they were stored
        foreach (var index in Enumerable.Range(0, turns.Length).Reverse())
            context.DefenseTurns.Add(new DefenseTurn
            {
                SessionId = sessionId,
                Role = index % 2 == 0 ? TranscriptRole.Examiner : TranscriptRole.Candidate,
                Content = turns[index],
                Sequence = index,
                CreatedAt = createdAt.AddMinutes(index),
            });
    }

    /// <summary>
    /// Tracks a comment under a proposal.
    /// </summary>
    /// <param name="context">The seeding context.</param>
    /// <param name="proposalId">The proposal.</param>
    /// <param name="authorId">Who wrote the comment.</param>
    /// <param name="content">What the comment says.</param>
    /// <param name="createdAt">When the comment was written.</param>
    /// <param name="status">Whether the comment is live, deleted or replaced.</param>
    private static void SeedComment(
        MathCompsDbContext context, Guid proposalId, Guid authorId, string content, DateTimeOffset createdAt,
        CommentStatus status)
    {
        // The comment
        var comment = new Comment { AuthorId = authorId, Content = content, CreatedAt = createdAt, Status = status };
        context.Comments.Add(comment);

        // Under the proposal
        context.ProposalComments.Add(new ProposalComment { ProposalId = proposalId, CommentId = comment.Id });
    }
}

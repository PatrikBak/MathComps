using MathComps.Domain.Contracts.Comments;
using MathComps.Domain.Contracts.Competitions;
using MathComps.Domain.Contracts.Selection;
using MathComps.Domain.Contracts.Users;
using MathComps.Domain.EfCoreEntities;
using MathComps.Domain.Localization;
using MathComps.Infrastructure.Extensions;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Comments;
using MathComps.Infrastructure.Services.Localization;
using MathComps.Infrastructure.Services.Selection;
using MathComps.Infrastructure.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace MathComps.Infrastructure.Tests.Selection;

/// <summary>
/// Covers <see cref="ProblemSelectionService"/> and <see cref="SelectionDiscussionService"/> over one seed: the field
/// mapping of the selection read, which proposals, boards and cycles it holds once groups open, which conversations
/// it lists, which discussions the discussions read holds, which of them a mark lands on and how far the seen read
/// finds each, and that each organization's selection holds its own alone and names the categories its reader leads.
/// </summary>
/// <remarks>
/// The seed is a pool of three proposals with a draft holding one. The October group has not opened and its
/// rounds are empty. The November group has not opened either, and has a board finalized into it. The September
/// group has opened, with a board finalized into it too. Each finalized board's problems sit in its group's rounds.
/// One problem sits in a December round no group runs any more, the way a corrected manifest leaves one. The
/// olympiad lists a category of its own and has a proposal of its own in the pool, under a number MathComps' pool
/// uses too, on a board of its own, with its commissioner's conversation about it. One comment stands in the
/// discussion of the first proposal, the first November problem, the September problem, the December problem, the
/// olympiad's proposal, and the first paper of every board.
/// </remarks>
/// <param name="fixture">The shared PostgreSQL container fixture.</param>
public class ProblemSelectionServicePostgresTests(PostgresContainerFixture fixture)
    : PostgresTestBase<IProblemSelectionService>(fixture)
{
    /// <summary>
    /// The slug of the olympiad, the organization beside MathComps.
    /// </summary>
    private const string OlympiadSlug = "olympiad";

    /// <summary>
    /// A reviewer whose account is live.
    /// </summary>
    private readonly Guid _reviewerId = Guid.CreateVersion7();

    /// <summary>
    /// A reviewer whose account is deleted.
    /// </summary>
    private readonly Guid _goneReviewerId = Guid.CreateVersion7();

    /// <summary>
    /// A second reviewer, who posted in no discussion.
    /// </summary>
    private readonly Guid _secondReviewerId = Guid.CreateVersion7();

    /// <summary>
    /// A member of the olympiad's commission, on its list alone.
    /// </summary>
    private readonly Guid _commissionerId = Guid.CreateVersion7();

    /// <summary>
    /// The pool's proposals by their number. The first is filed, set aside, written in two languages, talked about
    /// and rated; the third is deleted.
    /// </summary>
    private readonly Dictionary<int, Guid> _pool = [];

    /// <summary>
    /// The November group's problems, round by round in the order the hosted levels run.
    /// </summary>
    private readonly List<Guid> _november = [];

    /// <summary>
    /// A problem of the opened September group, with a conversation of its own.
    /// </summary>
    private Guid _openedId;

    /// <summary>
    /// A problem of a December round no group runs any more, discussed.
    /// </summary>
    private Guid _releasedId;

    /// <summary>
    /// The October group, which still takes a board.
    /// </summary>
    private Guid _octoberId;

    /// <summary>
    /// The board finalized into the November group.
    /// </summary>
    private Guid _novemberBoardId;

    /// <summary>
    /// The first paper of the draft, discussed.
    /// </summary>
    private Guid _draftPaperId;

    /// <summary>
    /// The first paper of the board finalized into the November group, discussed.
    /// </summary>
    private Guid _novemberPaperId;

    /// <summary>
    /// The first paper of the board finalized into the opened September group, discussed.
    /// </summary>
    private Guid _septemberPaperId;

    /// <summary>
    /// The olympiad's proposal, discussed.
    /// </summary>
    private Guid _olympiadProposalId;

    /// <summary>
    /// The olympiad's board, holding its proposal.
    /// </summary>
    private Guid _olympiadBoardId;

    /// <summary>
    /// The first paper of the olympiad's board, discussed.
    /// </summary>
    private Guid _olympiadPaperId;

    /// <inheritdoc/>
    protected override void ConfigureServices(IServiceCollection services) =>
        // The services under test, with the rest of the selection.
        services.AddProblemSelectionServices();

    /// <summary>
    /// A proposal reads with its filing and with a text for every language it has a statement in: the solution
    /// where one is written and null where not, and the hints split into the ladder. The language it was first written
    /// in comes with them.
    /// </summary>
    [Fact]
    public Task A_proposal_reads_with_its_filing_and_its_texts() => RunTestAsync(async service =>
    {
        // The selection
        var selection = await service.GetSelectionAsync(Organization.MathCompsSlug, _reviewerId, Language.EN);

        // The first proposal
        var proposal = selection.Proposals.Single(candidate => candidate.Id == _pool[1]);

        // Filed the way it was seeded
        Assert.Equal(
            (1, "Proposal 1", ProposalArea.Geometry, true, false),
            (proposal.Number, proposal.Title, proposal.Area, proposal.IsSetAside, proposal.IsUsed));

        // Its categories in the order they run, whatever order they were recommended in
        Assert.Equal(["elementary", "advanced"], proposal.Recommended);

        // A text in English and Slovak, the two it has statements in
        Assert.Equal([Language.SK, Language.EN], proposal.Texts.Keys.Order());

        // First written in English, the Slovak text a translation
        Assert.Equal(Language.EN, proposal.OriginalLanguage);

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
    /// The selection reads MathComps' categories in the order they run, each with the hosted level it is, and every
    /// paper names the category it fills. Another organization's category stays out.
    /// </summary>
    [Fact]
    public Task The_categories_are_the_organizations_own_in_order() => RunTestAsync(async service =>
    {
        // The selection
        var selection = await service.GetSelectionAsync(Organization.MathCompsSlug, _reviewerId, Language.EN);

        // MathComps' three, easiest first
        Assert.Equal(
            [
                new SelectionCategoryDto("elementary", HostedCompetitionCategory.Elementary),
                new SelectionCategoryDto("intermediate", HostedCompetitionCategory.Intermediate),
                new SelectionCategoryDto("advanced", HostedCompetitionCategory.Advanced),
            ],
            selection.Categories);

        // The draft's papers, each naming its category
        Assert.Equal(
            ["elementary", "intermediate", "advanced"],
            selection.Boards.Single(board => board.Finalization is null).Papers.Select(paper => paper.Category));
    });

    /// <summary>
    /// The selection names the categories its reader leads, and none for a reader leading nothing there.
    /// </summary>
    [Fact]
    public Task The_read_names_the_readers_lead_categories() => RunTestAsync(async service =>
    {
        // MathComps' advanced category, the one the reviewer leads
        Assert.Equal(
            ["advanced"],
            (await service.GetSelectionAsync(Organization.MathCompsSlug, _reviewerId, Language.EN)).LeadCategories);

        // None of the olympiad's for its commissioner, who leads nothing
        Assert.Empty(
            (await service.GetSelectionAsync(OlympiadSlug, _commissionerId, Language.EN)).LeadCategories);
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
        var selection = await service.GetSelectionAsync(Organization.MathCompsSlug, _reviewerId, Language.EN);

        // The draft
        var board = selection.Boards.Single(candidate => candidate.Finalization is null);

        // The draft's one problem, in the elementary paper's second slot
        Assert.Equal([null, _pool[2], null, null], board.Papers[0].Slots);

        // And its other papers empty
        Assert.All(board.Papers.Skip(1), paper => Assert.Equal([null, null, null, null], paper.Slots));
    });

    /// <summary>
    /// A finalized board whose group has not opened reads its slots off the group's rounds, in round order, and
    /// its problems count as used, the only ones: the December problem, outside the proposals in a round no group
    /// runs, has left the selection. A finalized board keeps no slot rows, so a read that took its slots from them
    /// would show it empty.
    /// </summary>
    [Fact]
    public Task A_finalized_board_reads_its_slots_off_its_rounds() => RunTestAsync(async service =>
    {
        // The selection
        var selection = await service.GetSelectionAsync(Organization.MathCompsSlug, _reviewerId, Language.EN);

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
        var selection = await service.GetSelectionAsync(Organization.MathCompsSlug, _reviewerId, Language.EN);

        // Two boards left: the November one and the draft
        Assert.Equal(2, selection.Boards.Count);

        // The September problem gone from the proposals
        Assert.DoesNotContain(selection.Proposals, proposal => proposal.Id == _openedId);

        // The September problem's conversation is gone with it
        Assert.DoesNotContain(selection.Conversations, conversation => conversation.ProposalId == _openedId);
    });

    /// <summary>
    /// A deleted proposal is gone from the read. A delete keeps the row under a stamp, so the read's own filter is
    /// all that keeps it out.
    /// </summary>
    [Fact]
    public Task A_deleted_proposal_is_gone_from_the_read() => RunTestAsync(async service =>
    {
        // The selection
        var selection = await service.GetSelectionAsync(Organization.MathCompsSlug, _reviewerId, Language.EN);

        // Without the third proposal
        Assert.DoesNotContain(selection.Proposals, proposal => proposal.Id == _pool[3]);
    });

    /// <summary>
    /// The discussions read holds what is said about the proposals still in the selection, a problem the November
    /// board took among them, and about the papers on its boards: the draft and the one finalized into a group still
    /// to open. What is said about the opened group's problem, the paper on the board filling that group and the
    /// December problem, in a round no group runs, stays out, and so does what is said about the olympiad's proposal
    /// and paper. The second proposal, which nobody discusses, gets no entry.
    /// </summary>
    [Fact]
    public Task The_discussions_are_those_of_what_the_selection_holds() =>
        QueryAsync<ISelectionDiscussionService>(async (_, discussionService) =>
        {
            // The discussions, as the live reviewer reads them
            var discussions = await discussionService.GetDiscussionsAsync(
                Organization.MathCompsSlug, new CommentViewer(_reviewerId, IsAdmin: false));

            // The first proposal's and the November problem's discussions alone, each holding its one comment
            Assert.Equivalent(
                new Dictionary<string, string>
                {
                    [_pool[1].ToString()] = $"On {_pool[1]}",
                    [_november[0].ToString()] = $"On {_november[0]}",
                },
                discussions.Proposals.ToDictionary(thread => thread.Key, thread => Assert.Single(thread.Value).Content),
                strict: true);

            // The draft paper's and the November paper's discussions alone, each holding its one comment
            Assert.Equivalent(
                new Dictionary<string, string>
                {
                    [_draftPaperId.ToString()] = $"On {_draftPaperId}",
                    [_novemberPaperId.ToString()] = $"On {_novemberPaperId}",
                },
                discussions.Papers.ToDictionary(thread => thread.Key, thread => Assert.Single(thread.Value).Content),
                strict: true);
        });

    /// <summary>
    /// A mark lands on the discussions the selection holds, one nobody has posted in included, and passes over the
    /// opened group's problem and the paper on its board. The read then finds the moment the mark handed back beside
    /// when the reviewer who wrote every seeded comment last posted, and a discussion left unmarked carries that alone.
    /// A later mark moves the moment on, a moment yet to come held to now, while a discussion it leaves out keeps the
    /// first.
    /// </summary>
    [Fact]
    public Task A_mark_lands_on_the_discussions_the_selection_holds() =>
        QueryAsync<ISelectionDiscussionService>(async (context, discussionService) =>
        {
            // The second reviewer, who posted in no discussion
            var secondReviewer = new CommentViewer(_secondReviewerId, IsAdmin: false);

            // MathComps' discussions, as the second reviewer reads them
            var discussions = await discussionService.GetDiscussionsAsync(Organization.MathCompsSlug, secondReviewer);

            // When each seeded comment was posted, as the database keeps it, by its discussion
            var postedAt = discussions.Proposals.Concat(discussions.Papers)
                .ToDictionary(thread => thread.Key, thread => Assert.Single(thread.Value).CreatedAt);

            // The second reviewer marks what they saw up to now, the opened group's problem and the September paper
            // among it
            var seenUpTo = await discussionService.MarkDiscussionsSeenAsync(
                Organization.MathCompsSlug,
                secondReviewer,
                [_pool[1], _pool[2], _openedId],
                [_draftPaperId, _septemberPaperId],
                DateTimeOffset.UtcNow);

            // The opened group's problem and the September paper, which the selection does not hold
            List<string> passedOver = [_openedId.ToString(), _septemberPaperId.ToString()];

            // No mark written on the opened group's problem or the September paper
            Assert.False(await context.CommentSeenMarks.AnyAsync(mark => passedOver.Contains(mark.TargetId)));

            // How far the second reviewer has seen the discussions
            var seen = await discussionService.GetDiscussionsSeenAsync(Organization.MathCompsSlug, secondReviewer);

            // A discussion the second reviewer never saw and nobody else posted in
            var untouched = new CommentThreadSeenDto(null, null);

            // Past the untouched ones, the marked proposals still in the selection and the November problem nobody
            // marked
            Assert.Equivalent(
                new Dictionary<string, CommentThreadSeenDto>
                {
                    [_pool[1].ToString()] = new(seenUpTo, postedAt[_pool[1].ToString()]),
                    [_pool[2].ToString()] = new(seenUpTo, null),
                    [_november[0].ToString()] = new(null, postedAt[_november[0].ToString()]),
                },
                seen.Proposals.Where(entry => entry.Value != untouched).ToDictionary(),
                strict: true);

            // Past the untouched ones, the marked draft paper and the November paper nobody marked
            Assert.Equivalent(
                new Dictionary<string, CommentThreadSeenDto>
                {
                    [_draftPaperId.ToString()] = new(seenUpTo, postedAt[_draftPaperId.ToString()]),
                    [_novemberPaperId.ToString()] = new(null, postedAt[_novemberPaperId.ToString()]),
                },
                seen.Papers.Where(entry => entry.Value != untouched).ToDictionary(),
                strict: true);

            // A later mark of the first proposal alone, claiming a moment a day ahead
            var later = await discussionService.MarkDiscussionsSeenAsync(
                Organization.MathCompsSlug, secondReviewer, [_pool[1]], [], DateTimeOffset.UtcNow.AddDays(1));

            // Held to now, since nothing posted tomorrow has been seen
            Assert.True(later <= DateTimeOffset.UtcNow);

            // How far the second reviewer has seen the discussions now
            var seenLater = await discussionService.GetDiscussionsSeenAsync(
                Organization.MathCompsSlug, secondReviewer);

            // The first proposal seen up to the later moment, the draft paper still up to the first
            Assert.Equal(later, seenLater.Proposals[_pool[1].ToString()].SeenUpTo);
            Assert.Equal(seenUpTo, seenLater.Papers[_draftPaperId.ToString()].SeenUpTo);
        });

    /// <summary>
    /// A reviewer outside the organization, on another one's list, marks none of its discussions and reads how far
    /// they have seen none of them.
    /// </summary>
    [Fact]
    public Task A_reviewer_outside_the_organization_marks_and_reads_none_of_its_discussions() =>
        QueryAsync<ISelectionDiscussionService>(async (context, discussionService) =>
        {
            // The commissioner, on the olympiad's list alone
            var commissioner = new CommentViewer(_commissionerId, IsAdmin: false);

            // The commissioner marks MathComps' first proposal and its draft paper as seen
            await discussionService.MarkDiscussionsSeenAsync(
                Organization.MathCompsSlug, commissioner, [_pool[1]], [_draftPaperId], DateTimeOffset.UtcNow);

            // No mark written
            Assert.False(await context.CommentSeenMarks.AnyAsync(mark => mark.UserId == _commissionerId));

            // How far the commissioner has seen MathComps' discussions
            var seen = await discussionService.GetDiscussionsSeenAsync(Organization.MathCompsSlug, commissioner);

            // None of them
            Assert.Empty(seen.Proposals);
            Assert.Empty(seen.Papers);
        });

    /// <summary>
    /// The cycles are the groups still taking a board: not the opened one, nor one already filled. Each carries
    /// its categories in the order the taxonomy sets them out, and its name in the language asked for.
    /// </summary>
    [Fact]
    public Task The_cycles_are_the_groups_still_taking_a_board() => RunTestAsync(async service =>
    {
        // The selection, read in Slovak
        var selection = await service.GetSelectionAsync(Organization.MathCompsSlug, _reviewerId, Language.SK);

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
        var selection = await service.GetSelectionAsync(Organization.MathCompsSlug, _reviewerId, Language.EN);

        // So no group takes a board
        Assert.Empty(selection.Cycles);
    });

    /// <summary>
    /// Conversations read newest first, each with who held it, how many messages it holds and whether the problem
    /// still has the statement it was argued against, in any of its languages. The author carries their username and
    /// address, or neither once their account is deleted, and a deleted account's conversations stay in the
    /// selection.
    /// </summary>
    [Fact]
    public Task Conversations_read_with_their_authors_and_whether_their_statement_stands() =>
        RunTestAsync(async service =>
        {
            // The selection
            var selection = await service.GetSelectionAsync(Organization.MathCompsSlug, _reviewerId, Language.EN);

            // The first proposal's conversations
            var conversations = selection.Conversations
                .Where(conversation => conversation.ProposalId == _pool[1])
                .ToList();

            // Newest first: the English statement and the Slovak one still stand, the older statement is gone, and
            // the deleted reviewer's conversation goes by nobody
            Assert.Equal(
                [
                    (new UserIdentityDto(_reviewerId, "Reviewer", "reviewer@example.com"), 2, false),
                    (new UserIdentityDto(_reviewerId, "Reviewer", "reviewer@example.com"), 1, false),
                    (new UserIdentityDto(_reviewerId, "Reviewer", "reviewer@example.com"), 1, true),
                    (new UserIdentityDto(_goneReviewerId, null, null), 1, false),
                ],
                conversations.Select(conversation => (
                    conversation.Author,
                    conversation.MessageCount,
                    conversation.HasOlderStatement)));
        });

    /// <summary>
    /// A proposal reads with every rating it was given, by the reviewers' names, each with who gave it, whether the
    /// reviewer reading gave it, and the scores as given, a score left out read as none. A rater has no name once
    /// their account is deleted. A deleted account keeps its username, so a read ordering by it would still file the
    /// nameless rating under the name it no longer shows.
    /// </summary>
    [Fact]
    public Task Ratings_read_with_their_raters() => RunTestAsync(async service =>
    {
        // The selection, as the live reviewer reads it
        var selection = await service.GetSelectionAsync(Organization.MathCompsSlug, _reviewerId, Language.EN);

        // The first proposal's ratings: the reader's own, then the deleted reviewer's, which has no name to go by
        Assert.Equal(
            [
                (new UserIdentityDto(_reviewerId, "Reviewer", "reviewer@example.com"), true, 4.7m, 2),
                (new UserIdentityDto(_goneReviewerId, null, null), false, 5, null),
            ],
            selection.Proposals
                .Single(proposal => proposal.Id == _pool[1])
                .Ratings
                .Select(rating => (rating.Rater, rating.IsOwn, rating.Beauty, rating.Difficulty)));
    });

    /// <summary>
    /// The selection reads as needing every language, since the migrations set MathComps' row that way: its problems
    /// go into the hosted rounds.
    /// </summary>
    [Fact]
    public Task MathComps_needs_every_language() => RunTestAsync(async service =>
    {
        // The selection
        var selection = await service.GetSelectionAsync(Organization.MathCompsSlug, _reviewerId, Language.EN);

        // Needing a text in every language
        Assert.True(selection.NeedsEveryLanguage);
    });

    /// <summary>
    /// The selection carries whatever its organization's row says, so an organization set to any one text reads as
    /// needing no more than one.
    /// </summary>
    [Fact]
    public Task The_organization_says_which_languages_it_needs() => RunTestAsync(async service =>
    {
        // MathComps set to any one text
        await QueryAsync(context => context.Organizations
            .Where(organization => organization.Slug == Organization.MathCompsSlug)
            .ExecuteUpdateAsync(setters =>
                setters.SetProperty(organization => organization.NeedsEveryLanguage, false)));

        // The selection
        var selection = await service.GetSelectionAsync(Organization.MathCompsSlug, _reviewerId, Language.EN);

        // Needing no more than one text
        Assert.False(selection.NeedsEveryLanguage);
    });

    /// <summary>
    /// An organization's selection holds its own categories, proposals, boards, conversations and discussions alone,
    /// and says whether its own problems need every language: the olympiad's reads its one of each and needs any one
    /// language, and MathComps' reads none of the olympiad's. The hosted groups take MathComps' boards alone, so the
    /// olympiad's has no cycle to finalize into.
    /// </summary>
    [Fact]
    public Task An_organizations_selection_holds_its_own_alone() => RunTestAsync(async service =>
    {
        // The olympiad's selection, as the commissioner reads it
        var olympiad = await service.GetSelectionAsync(OlympiadSlug, _commissionerId, Language.EN);

        // Its one category, needing a text in any one language
        Assert.Equal(["C"], olympiad.Categories.Select(category => category.Name));
        Assert.False(olympiad.NeedsEveryLanguage);

        // Its one proposal, its one board and the commissioner's conversation about it
        Assert.Equal([_olympiadProposalId], olympiad.Proposals.Select(proposal => proposal.Id));
        Assert.Equal([_olympiadBoardId], olympiad.Boards.Select(board => board.Id));
        Assert.Equal([_olympiadProposalId], olympiad.Conversations.Select(conversation => conversation.ProposalId));

        // And no cycle
        Assert.Empty(olympiad.Cycles);

        // MathComps' selection, as the live reviewer reads it
        var mathComps = await service.GetSelectionAsync(Organization.MathCompsSlug, _reviewerId, Language.EN);

        // None of the olympiad's in it
        Assert.DoesNotContain(mathComps.Proposals, proposal => proposal.Id == _olympiadProposalId);
        Assert.DoesNotContain(mathComps.Boards, board => board.Id == _olympiadBoardId);
        Assert.DoesNotContain(
            mathComps.Conversations, conversation => conversation.ProposalId == _olympiadProposalId);

        // The olympiad's discussions, as the commissioner reads them
        var discussions = await QueryValueAsync<ISelectionDiscussionService, SelectionDiscussionsDto>(
            (_, discussionService) => discussionService.GetDiscussionsAsync(
                OlympiadSlug, new CommentViewer(_commissionerId, IsAdmin: false)));

        // Its proposal's and its paper's alone
        Assert.Equal([_olympiadProposalId.ToString()], discussions.Proposals.Keys);
        Assert.Equal([_olympiadPaperId.ToString()], discussions.Papers.Keys);
    });

    /// <inheritdoc/>
    protected override async Task SeedDataAsync(MathCompsDbContext context)
    {
        // The reviewer whose account is live
        context.Users.Add(HostedSeed.NewUser(_reviewerId, "Reviewer"));

        // And the one whose account is deleted, the way deletion leaves it: the address cleared, the name kept
        var gone = HostedSeed.NewUser(_goneReviewerId, "Gone");
        gone.Email = null;
        gone.IsDeleted = true;
        context.Users.Add(gone);

        // The live reviewer on the MathComps organization's list
        SelectionSeed.NewMember(context, "reviewer@example.com", DateTimeOffset.UtcNow.AddDays(-30));

        // The reviewer made a lead of MathComps' advanced category
        SelectionSeed.NewLead(context, "reviewer@example.com", "advanced");

        // The second reviewer
        context.Users.Add(HostedSeed.NewUser(_secondReviewerId, "Second"));

        // The second reviewer on the MathComps organization's list too
        SelectionSeed.NewMember(context, "second@example.com", DateTimeOffset.UtcNow.AddDays(-30));

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

        // The instant the groups and conversations are dated from
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

        // The November board's first paper
        _novemberPaperId = FirstPaperOf(context, _novemberBoardId);

        // September, already open
        var september = SelectionSeed.NewGroup(context, season, "september", now.AddDays(-1));

        // One problem in September's first round
        _openedId = SelectionSeed.NewProposal(context, september.Rounds.First(), 200, 1);

        // A board finalized into September, and its first paper
        _septemberPaperId = FirstPaperOf(context, SeedFinalizedBoard(context, september));

        // A conversation about the September problem
        SeedConversation(context, _openedId, _reviewerId, "Statement", now, "Turn");

        // A December round its group let go of
        var released = new Round
        {
            Id = Guid.CreateVersion7(),
            CompetitionId = CompetitionTreeSeed.Chain(context, SelectionSeed.RoundPaths("december")[0]).Id,
            SeasonId = season.Id,
            Date = new DateOnly(2026, 12, 1),
            VisibleSince = now.AddDays(70),
        };
        context.Rounds.Add(released);

        // One problem in the December round
        _releasedId = SelectionSeed.NewProposal(context, released, 400, 1);

        // A draft holding the second proposal in its second slot, and its first paper
        _draftPaperId = FirstPaperOf(context, SelectionSeed.NewBoard(context, "Draft", null, _pool[2]).Id);

        // The olympiad, listing a category of its own
        var olympiadId = SelectionSeed.NewOrganization(context, OlympiadSlug, "C");

        // The commissioner
        context.Users.Add(HostedSeed.NewUser(_commissionerId, "Commissioner"));

        // The commissioner on the olympiad's list
        SelectionSeed.NewMember(context, olympiadId, "commissioner@example.com", now.AddDays(-30));

        // The olympiad's proposal in the pool, under the number MathComps' first proposal holds
        _olympiadProposalId = SelectionSeed.NewProposal(context, olympiadId, pool, 1, 10);

        // The olympiad's board, holding its proposal in its first slot
        _olympiadBoardId = SelectionSeed.NewBoard(context, olympiadId, "Olympiad", _olympiadProposalId).Id;

        // The olympiad board's first paper
        _olympiadPaperId = FirstPaperOf(context, _olympiadBoardId);

        // The commissioner's conversation about the olympiad's proposal
        SeedConversation(context, _olympiadProposalId, _commissionerId, "Statement 1 in EN", now, "Ahoj");

        // A comment about the first proposal, a November problem, the September problem, the December one and the
        // olympiad's
        foreach (var proposalId in new[] { _pool[1], _november[0], _openedId, _releasedId, _olympiadProposalId })
            context.ProposalComments.Add(new ProposalComment
            {
                ProposalId = proposalId,
                CommentId = SeedComment(context, $"On {proposalId}"),
            });

        // A comment about the first paper of every board
        foreach (var paperId in new[] { _draftPaperId, _novemberPaperId, _septemberPaperId, _olympiadPaperId })
            context.SelectionPaperComments.Add(new SelectionPaperComment
            {
                PaperId = paperId,
                CommentId = SeedComment(context, $"On {paperId}"),
            });

        // The first proposal's oldest conversation, by the deleted reviewer
        SeedConversation(context, _pool[1], _goneReviewerId, "Statement 1 in EN", now.AddDays(-3), "Gone");

        // The first proposal's next conversation, about a statement since changed
        SeedConversation(context, _pool[1], _reviewerId, "Older statement", now.AddDays(-2), "Old");

        // The first proposal's conversation about its Slovak statement
        SeedConversation(context, _pool[1], _reviewerId, "Statement 1 in SK", now.AddDays(-1).AddHours(-1), "Hi");

        // The first proposal's newest conversation, about its English statement
        SeedConversation(context, _pool[1], _reviewerId, "Statement 1 in EN", now.AddDays(-1), "First", "Second");

        // The live reviewer's rating of the first proposal, both scores given, the beauty on a tenth
        context.ProposalRatings.Add(new ProposalRating
        {
            ProposalId = _pool[1],
            UserId = _reviewerId,
            Beauty = 4.7m,
            Difficulty = 2,
        });

        // And the deleted reviewer's, its beauty alone
        context.ProposalRatings.Add(new ProposalRating
        {
            ProposalId = _pool[1],
            UserId = _goneReviewerId,
            Beauty = 5,
        });

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
        proposal.IsSetAside = true;

        // Recommended for two categories, the harder one first
        SelectionSeed.Recommend(context, problemId, "advanced", "elementary");

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
    /// The first paper of a board just tracked.
    /// </summary>
    /// <param name="context">The seeding context.</param>
    /// <param name="boardId">The board.</param>
    /// <returns>The paper's id.</returns>
    private static Guid FirstPaperOf(MathCompsDbContext context, Guid boardId) =>
        // The board's paper in the first position
        context.SelectionPapers.Local.Single(paper => paper.BoardId == boardId && paper.Position == 0).Id;

    /// <summary>
    /// Tracks a comment by the live reviewer, linked to nothing yet.
    /// </summary>
    /// <param name="context">The seeding context.</param>
    /// <param name="content"><inheritdoc cref="Comment.Content" path="/summary"/></param>
    /// <returns>The comment's id.</returns>
    private Guid SeedComment(MathCompsDbContext context, string content)
    {
        // The comment, at the top of its discussion
        var comment = new Comment { AuthorId = _reviewerId, Content = content, CreatedAt = DateTimeOffset.UtcNow };
        context.Comments.Add(comment);

        // The id
        return comment.Id;
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

        // The session's turns
        foreach (var index in Enumerable.Range(0, turns.Length))
            context.DefenseTurns.Add(new DefenseTurn
            {
                SessionId = sessionId,
                Role = index % 2 == 0 ? TranscriptRole.Examiner : TranscriptRole.Candidate,
                Content = turns[index],
                Sequence = index,
                CreatedAt = createdAt.AddMinutes(index),
            });
    }
}

using MathComps.Domain.Contracts.ConversationReview;
using MathComps.Domain.Contracts.Defense;
using Category = MathComps.Domain.EfCoreEntities.DefenseReportCategory;
using MathComps.Domain.Localization;
using MathComps.Infrastructure.Options;
using MathComps.Infrastructure.Services.Admin;
using MathComps.Infrastructure.Services.ConversationReview;
using MathComps.Infrastructure.Tests.ConversationReview;
using MathComps.Infrastructure.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MsOptions = Microsoft.Extensions.Options.Options;
using static MathComps.Infrastructure.Tests.ConversationReview.ReviewNoteSeed;

namespace MathComps.Infrastructure.Tests.Admin;

/// <summary>
/// Integration tests for <see cref="AdminNoteService"/> against a real PostgreSQL database: that settling a note
/// shows up in the feed, what the feed carries of where each note was written and whose it is, how it cuts a page
/// and what it leaves out of one.
/// </summary>
/// <param name="fixture">The shared PostgreSQL container fixture.</param>
public class AdminNoteServicePostgresTests(PostgresContainerFixture fixture)
    : ReviewNotePostgresTestBase<IAdminNoteService>(fixture)
{
    /// <summary>
    /// Settling a note stamps it and leaves it where it is; putting it back to standing clears the stamp. The feed
    /// reads the stamp to decide what still counts as an open problem.
    /// </summary>
    [Fact]
    public Task Settling_a_note_is_reversible_and_the_feed_follows_it() => RunTestAsync(async service =>
    {
        // Write two notes
        var settled = await WriteNoteAsync(
            ReviewerId, SessionId, ReplyId, "she gave it away", Category.GaveAway);
        await WriteNoteAsync(ReviewerId, SessionId, null, "went in circles", null);

        // Settle one
        await QueryAsync<IReviewNoteService>((_, notes) => notes.SetResolvedAsync(settled.Id, resolved: true));

        // The whole feed
        var all = await service.GetFeedAsync(ReviewerId, openOnly: false, 1, Language.EN);

        // Still carrying both
        Assert.Equal(2, all.TotalCount);

        // Ask for the open set
        var open = await service.GetFeedAsync(ReviewerId, openOnly: true, 1, Language.EN);

        // Where only one still stands
        Assert.Equal(1, open.TotalCount);
        Assert.Equal("went in circles", open.Items.Single().Note.Content);

        // Put it back to standing
        await QueryAsync<IReviewNoteService>((_, notes) => notes.SetResolvedAsync(settled.Id, resolved: false));

        // The open set once more
        var reopened = await service.GetFeedAsync(ReviewerId, openOnly: true, 1, Language.EN);

        // Holding both again
        Assert.Equal(2, reopened.TotalCount);
    });

    /// <summary>
    /// The feed carries enough of where a note was written to be read without opening the conversation: who held
    /// it, which environment it was about, and where in it the reply sits.
    /// </summary>
    [Fact]
    public Task The_feed_carries_where_each_note_was_written() => RunTestAsync(async service =>
    {
        // A note against a reply
        await WriteNoteAsync(ReviewerId, SessionId, ReplyId, "she gave it away", null);

        // A note against the whole conversation
        await WriteNoteAsync(ReviewerId, SessionId, null, "went in circles", null);

        // Read the feed, newest first
        var feed = await service.GetFeedAsync(ReviewerId, openOnly: false, 1, Language.EN);

        // The newest note
        var newest = feed.Items[0];

        // Which is the one about the conversation, sitting at no particular reply
        Assert.Equal("went in circles", newest.Note.Content);
        Assert.Null(newest.TurnSequence);

        // The other names the reply's place in the conversation
        Assert.Equal(ReplySequence, feed.Items[1].TurnSequence);

        // And both carry who held the conversation
        Assert.Equal(["Student"], feed.Items.Select(item => item.User.Username).Distinct());

        // Beside the reviewer whose reading each one is, who is somebody else entirely
        Assert.Equal([ReviewerId], feed.Items.Select(item => item.Note.Author.Id).Distinct());

        // As well as which environment it was about
        Assert.Equal(["problem-one"], feed.Items.Select(item => Handout(item.Target).EnvironmentId).Distinct());
    });

    /// <summary>
    /// A note on a competition conversation carries the problem named from the taxonomy. The feed reads its
    /// problem through a projection of its own, so the review queue naming one is no evidence that the feed does.
    /// </summary>
    [Fact]
    public Task The_feed_names_an_archive_problem_by_where_it_comes_from() => RunTestAsync(async service =>
    {
        // A note on the conversation held against an archive problem
        await WriteNoteAsync(ReviewerId, ArchiveSessionId, null, "she led him to it", null);

        // Read the feed
        var feed = await service.GetFeedAsync(ReviewerId, openOnly: false, 1, Language.EN);

        // The one note, naming an archive problem rather than a handout one
        var target = Assert.IsType<NamedProblemTarget>(Assert.Single(feed.Items).Target);
        Assert.Equal(ArchiveProblemSlug, target.Slug);

        // Which is every competition down to the one that set it, each named in the language asked for
        Assert.Equal(
            ["Mathilding", "Advanced", "September"],
            target.Source.Competition.Select(competition => competition.DisplayName));

        // Along with the season's own year and the problem's place in the competition
        Assert.Equal(2026, target.Source.StartYear);
        Assert.Equal(2, target.Source.Number);
    });

    /// <summary>
    /// Authorship travels with the note so the surface can tell whose it is without holding an identity of its own.
    /// </summary>
    [Fact]
    public Task The_feed_says_which_notes_the_reader_wrote() => RunTestAsync(async service =>
    {
        // One note from each reviewer
        await WriteNoteAsync(ReviewerId, SessionId, null, "mine", null);
        await WriteNoteAsync(OtherReviewerId, SessionId, null, "theirs", null);

        // Read back as the first reviewer
        var feed = await service.GetFeedAsync(ReviewerId, openOnly: false, 1, Language.EN);

        // Only their own comes back as theirs to change
        Assert.Equal(
            [("theirs", false), ("mine", true)],
            feed.Items.Select(item => (item.Note.Content, item.Note.IsOwn)));
    });

    /// <summary>
    /// A conversation held against nothing at all stays out of the feed whole, count included: opening one takes the
    /// thing it was held against, so a line about it would lead nowhere.
    /// </summary>
    [Fact]
    public Task The_feed_leaves_out_a_conversation_held_against_nothing() => RunTestAsync(async service =>
    {
        // A note about a conversation held against a handout environment
        await WriteNoteAsync(ReviewerId, SessionId, null, "went in circles", null);

        // And one about the conversation held against nothing
        await WriteNoteAsync(ReviewerId, UntargetedSessionId, null, "nowhere to open", null);

        // Read the feed
        var feed = await service.GetFeedAsync(ReviewerId, openOnly: false, 1, Language.EN);

        // Which carries the one note that can be followed back
        Assert.Equal("went in circles", Assert.Single(feed.Items).Note.Content);

        // And counts it alone, so the pager promises no line it won't serve
        Assert.Equal(1, feed.TotalCount);
    });

    /// <summary>
    /// A note on a conversation held against a proposal reaches only the members of the organization whose pool the
    /// proposal is in, and names the proposal, by the number and the working name the reviewers quote it by, since
    /// no competition has set it.
    /// </summary>
    [Fact]
    public Task The_feed_names_a_proposals_conversation_by_the_proposal_to_its_members() =>
        RunTestAsync(async service =>
        {
            // A note about the proposal conversation
            await WriteNoteAsync(ReviewerId, ProposalSessionId, null, "about a proposal", null);

            // The feed while the reviewer is on no list
            var before = await service.GetFeedAsync(ReviewerId, openOnly: false, 1, Language.EN);

            // Leaving the note out, the proposal being in MathComps' pool
            Assert.Equal(0, before.TotalCount);

            // The reviewer on MathComps' list
            await QueryAsync(async context =>
            {
                // The reviewer's account, given an address
                (await context.Users.SingleAsync(user => user.Id == ReviewerId)).Email = "reviewer@example.com";

                // The address on the list
                SelectionSeed.NewMember(context, "reviewer@example.com", DateTimeOffset.UtcNow.AddDays(-30));

                // Written down
                await context.SaveChangesAsync();
            });

            // Read the feed
            var feed = await service.GetFeedAsync(ReviewerId, openOnly: false, 1, Language.EN);

            // The note's problem, which is a proposal rather than a competition problem
            var proposal = Assert.IsType<NamedProposalTarget>(Assert.Single(feed.Items).Target);

            // Named by the proposal filing it
            Assert.Equal((21, "Proposal 21"), (proposal.Number, proposal.Title));
        });

    /// <summary>
    /// Paging cuts the one run of notes, so a page carries as many as the server serves and the next one carries on
    /// where it stopped.
    /// </summary>
    [Fact]
    public Task Paging_cuts_the_feed_where_the_page_ends() => RunTestAsync(
        async service =>
        {
            // Three notes, written oldest first
            await WriteNoteAsync(ReviewerId, SessionId, null, "first", null);
            await WriteNoteAsync(ReviewerId, SessionId, null, "second", null);
            await WriteNoteAsync(ReviewerId, SessionId, null, "third", null);

            // Ask for the first page
            var first = await service.GetFeedAsync(ReviewerId, openOnly: false, 1, Language.EN);

            // And for the rest
            var second = await service.GetFeedAsync(ReviewerId, openOnly: false, 2, Language.EN);

            // The first page holds the two most recent, newest ahead of the one before it
            Assert.Equal(["third", "second"], first.Items.Select(item => item.Note.Content));

            // The second carries on with the oldest rather than repeating anything
            Assert.Equal("first", Assert.Single(second.Items).Note.Content);

            // And both report the same total, which is what says a third page would hold nothing
            Assert.Equal(3, first.TotalCount);
            Assert.Equal(3, second.TotalCount);
        },
        // A page smaller than what the test writes, so the feed has a second one to carry on to
        services => services.AddSingleton(
            MsOptions.Create(new PaginationOptions { DefaultPageSize = 2 })));

    /// <summary>
    /// Writes a note through the note service, in a scope of its own.
    /// </summary>
    /// <param name="authorId">The reviewer writing it.</param>
    /// <param name="sessionId">The conversation the note is about.</param>
    /// <param name="turnId">The reply it stands against, or null for the conversation as a whole.</param>
    /// <param name="content">What it says.</param>
    /// <param name="category">Which failure it names, or null to name none.</param>
    /// <returns>The note as written.</returns>
    private Task<ReviewNoteDto> WriteNoteAsync(
        Guid authorId, Guid sessionId, Guid? turnId, string content, Category? category) =>
        // The note as the note service writes it
        QueryValueAsync<IReviewNoteService, ReviewNoteDto>(
            (_, notes) => notes.CreateAsync(authorId, sessionId, turnId, content, category));

    /// <summary>
    /// Reads a conversation's problem as the handout environment it is, failing the test when it is anything
    /// else, which is what lets an assertion name a handout's own fields.
    /// </summary>
    /// <param name="target">The problem a conversation was held against.</param>
    /// <returns>The handout environment.</returns>
    private static NamedHandoutTarget Handout(NamedDefenseTarget target) =>
        Assert.IsType<NamedHandoutTarget>(target);
}

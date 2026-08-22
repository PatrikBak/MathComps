using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Extensions;
using MathComps.Infrastructure.Options;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Admin;
using MathComps.Infrastructure.Services.Defense;
using MathComps.Infrastructure.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Category = MathComps.Domain.EfCoreEntities.DefenseReportCategory;
using MsOptions = Microsoft.Extensions.Options.Options;

namespace MathComps.Infrastructure.Tests.Admin;

/// <summary>
/// Integration tests for <see cref="AdminNoteService"/> against a real PostgreSQL database: what a note refuses to
/// be written as, that settling one is reversible and shows up in the feed, how the feed cuts a page and what it
/// leaves out of one, and the deletion rules the storage design turns on — a note against a reply dies with that
/// reply, one against the conversation outlives a rewind, and both die with the conversation.
/// </summary>
/// <param name="fixture">The shared PostgreSQL container fixture.</param>
public class AdminNoteServicePostgresTests(PostgresContainerFixture fixture)
    : PostgresTestBase<IAdminNoteService>(fixture)
{
    /// <summary>
    /// The student holding the seeded conversations.
    /// </summary>
    private static readonly Guid _studentId = Guid.Parse("00000000-0000-0000-0000-000000000001");

    /// <summary>
    /// The reviewer writing the notes.
    /// </summary>
    private static readonly Guid _reviewerId = Guid.Parse("00000000-0000-0000-0000-0000000000f1");

    /// <summary>
    /// A second reviewer, so a note can be reached for by somebody who didn't write it.
    /// </summary>
    private static readonly Guid _otherReviewerId = Guid.Parse("00000000-0000-0000-0000-0000000000f2");

    /// <summary>
    /// The conversation every note is written about.
    /// </summary>
    private static readonly Guid _sessionId = Guid.Parse("00000000-0000-0000-0000-0000000000a1");

    /// <summary>
    /// A second conversation, so a note can be pointed at a reply from the wrong one.
    /// </summary>
    private static readonly Guid _otherSessionId = Guid.Parse("00000000-0000-0000-0000-0000000000a2");

    /// <summary>
    /// A conversation with no problem behind it, which nothing can open.
    /// </summary>
    private static readonly Guid _untargetedSessionId = Guid.Parse("00000000-0000-0000-0000-0000000000a3");

    /// <summary>
    /// The reply the notes are written against.
    /// </summary>
    private static readonly Guid _replyId = Guid.Parse("00000000-0000-0000-0000-0000000000b2");

    /// <summary>
    /// A reply from the other conversation, which a note about this one may not reach.
    /// </summary>
    private static readonly Guid _otherSessionReplyId = Guid.Parse("00000000-0000-0000-0000-0000000000b3");

    /// <summary>
    /// Where the reply sits, which a rewind cuts back past.
    /// </summary>
    private const int ReplySequence = 2;

    /// <inheritdoc/>
    protected override void ConfigureServices(IServiceCollection services)
    {
        // The bounds the feed cuts its page by, left at their defaults, which hold everything a test writes.
        services.AddPaginationOptions();

        // The service under test.
        services.AddScoped<IAdminNoteService, AdminNoteService>();
    }

    /// <inheritdoc/>
    protected override async Task SeedDataAsync(MathCompsDbContext context)
    {
        // The student whose conversations are being reviewed, and the two reviewers reading them.
        context.Users.AddRange(
            new User { Id = _studentId, ExternalId = "ext-student", Username = "Student" },
            new User { Id = _reviewerId, ExternalId = "ext-reviewer", Username = "Reviewer" },
            new User { Id = _otherReviewerId, ExternalId = "ext-reviewer-2", Username = "Other reviewer" });

        // The handout and problem the conversations were held against, which the feed reads back.
        var handoutId = Guid.CreateVersion7();
        var problemId = Guid.CreateVersion7();
        context.Handouts.Add(new Handout { Id = handoutId, ContentId = "handout-one" });
        context.HandoutEnvironments.Add(
            new HandoutEnvironment { Id = problemId, HandoutId = handoutId, ContentId = "problem-one" });

        // Three conversations, the first shaped like a real one: opener, the student, the reply.
        context.DefenseSessions.AddRange(
            NewSession(_sessionId), NewSession(_otherSessionId), NewSession(_untargetedSessionId));

        // The turns of the conversation under test.
        context.DefenseTurns.AddRange(
            NewTurn(Guid.CreateVersion7(), _sessionId, TranscriptRole.Examiner, "the opener", 0),
            NewTurn(Guid.CreateVersion7(), _sessionId, TranscriptRole.Candidate, "my defense", 1),
            NewTurn(_replyId, _sessionId, TranscriptRole.Examiner, "her reply", ReplySequence));

        // A lone reply in the other conversation, for the cross-conversation check.
        context.DefenseTurns.Add(
            NewTurn(_otherSessionReplyId, _otherSessionId, TranscriptRole.Examiner, "elsewhere", 0));

        // What the first two were held against, so the feed has a problem to name. The third is left standing
        // against nothing, which is the state the feed reads as unreachable.
        context.HandoutEnvironmentDefenses.AddRange(
            new HandoutEnvironmentDefense { DefenseSessionId = _sessionId, HandoutEnvironmentId = problemId },
            new HandoutEnvironmentDefense { DefenseSessionId = _otherSessionId, HandoutEnvironmentId = problemId });

        // Commit the seed.
        await context.SaveChangesAsync();
    }

    /// <summary>
    /// Several notes can stand against one reply, since a reply can be wrong in more than one way and each is
    /// worth saying separately.
    /// </summary>
    [Fact]
    public Task Notes_against_one_reply_accumulate() => RunTestAsync(async service =>
    {
        // Say one thing about the reply
        await service.CreateAsync(_reviewerId, _sessionId, _replyId, "she gave it away", Category.GaveAway);

        // Then another
        await service.CreateAsync(_reviewerId, _sessionId, _replyId, "and was curt", Category.Tone);

        // Both stand, rather than the second replacing the first
        await QueryAsync(async context =>
            Assert.Equal(2, await context.AdminNotes.CountAsync(note => note.TurnId == _replyId)));
    });

    /// <summary>
    /// A note against a reply has to be against one of its own conversation's, so a reply id from elsewhere is
    /// refused rather than quietly filed under the wrong conversation.
    /// </summary>
    [Fact]
    public Task A_note_cannot_name_another_conversations_reply() => RunTestAsync(async service =>
    {
        // Point a note about this conversation at the other one's reply
        await Assert.ThrowsAsync<AdminNoteTargetException>(() => service.CreateAsync(
            _reviewerId, _sessionId, _otherSessionReplyId, "wrong conversation", null));

        // Nothing was written
        await QueryAsync(async context => Assert.Empty(await context.AdminNotes.ToListAsync()));
    });

    /// <summary>
    /// A note has to say something and to name a failure the contract knows, and a conversation that isn't there
    /// can't be written about at all.
    /// </summary>
    [Fact]
    public Task A_note_that_says_nothing_is_refused() => RunTestAsync(async service =>
    {
        // Whitespace is the same as saying nothing
        await Assert.ThrowsAsync<AdminNoteValueException>(() => service.CreateAsync(
            _reviewerId, _sessionId, null, "   ", null));

        // A failure outside the ones the contract names can't reach the column
        await Assert.ThrowsAsync<AdminNoteValueException>(() => service.CreateAsync(
            _reviewerId, _sessionId, null, "something", (Category)99));

        // And a conversation that isn't there has nothing to be written about
        await Assert.ThrowsAsync<DefenseSessionNotFoundException>(() => service.CreateAsync(
            _reviewerId, Guid.NewGuid(), null, "something", null));
    });

    /// <summary>
    /// Settling a note stamps it and leaves it where it is; putting it back to standing clears the stamp. The feed
    /// reads the stamp to decide what still counts as an open problem.
    /// </summary>
    [Fact]
    public Task Settling_a_note_is_reversible_and_the_feed_follows_it() => RunTestAsync(async service =>
    {
        // Write two notes
        var settled = await service.CreateAsync(
            _reviewerId, _sessionId, _replyId, "she gave it away", Category.GaveAway);
        await service.CreateAsync(_reviewerId, _sessionId, null, "went in circles", null);

        // Settle one
        await service.SetResolvedAsync(settled.Id, resolved: true);

        // The feed still carries both
        Assert.Equal(2, (await service.GetFeedAsync(_reviewerId, openOnly: false, 1)).TotalCount);

        // Ask for the open set
        var open = await service.GetFeedAsync(_reviewerId, openOnly: true, 1);

        // Where only one still stands
        Assert.Equal(1, open.TotalCount);
        Assert.Equal("went in circles", open.Items.Single().Note.Content);

        // Put it back to standing
        await service.SetResolvedAsync(settled.Id, resolved: false);

        // Which brings it into the open set again
        Assert.Equal(2, (await service.GetFeedAsync(_reviewerId, openOnly: true, 1)).TotalCount);
    });

    /// <summary>
    /// The feed carries enough of where a note was written to be read without opening the conversation: who held
    /// it, which problem it was about, and where in it the reply sits.
    /// </summary>
    [Fact]
    public Task The_feed_carries_where_each_note_was_written() => RunTestAsync(async service =>
    {
        // A note against a reply
        await service.CreateAsync(_reviewerId, _sessionId, _replyId, "she gave it away", null);

        // A note against the whole conversation
        await service.CreateAsync(_reviewerId, _sessionId, null, "went in circles", null);

        // Read the feed, newest first
        var feed = await service.GetFeedAsync(_reviewerId, openOnly: false, 1);

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
        Assert.Equal([_reviewerId], feed.Items.Select(item => item.Note.Author.Id).Distinct());

        // As well as which problem it was about
        Assert.Equal(["problem-one"], feed.Items.Select(item => item.Target.EnvironmentId).Distinct());
    });

    /// <summary>
    /// Revising a note replaces what it says rather than adding to it, and clearing the category is done by
    /// leaving it out of the revision.
    /// </summary>
    [Fact]
    public Task Revising_a_note_replaces_what_it_says() => RunTestAsync(async service =>
    {
        // Write it with a category
        var note = await service.CreateAsync(
            _reviewerId, _sessionId, _replyId, "she gave it away", Category.GaveAway);

        // Which reads as never revised, both its stamps being the one moment it was written
        Assert.Equal(note.CreatedAt, note.UpdatedAt);

        // What the row was written with, read back rather than compared against the in-memory stamp, which
        // carries finer ticks than the column keeps
        var writtenAt = await QueryValueAsync(context =>
            context.AdminNotes.Where(stored => stored.Id == note.Id).Select(stored => stored.CreatedAt).SingleAsync());

        // Revise it, naming no failure this time
        var revised = await service.UpdateAsync(_reviewerId, note.Id, "actually she was right", null);

        // It says the new thing and names nothing
        Assert.Equal("actually she was right", revised.Content);
        Assert.Null(revised.Category);

        // The first stamp stands, and the revision moved the second past it
        Assert.Equal(writtenAt, revised.CreatedAt);
        Assert.True(revised.UpdatedAt > note.UpdatedAt);
    });

    /// <summary>
    /// A revision stands for the note's whole new state, so it is held to everything writing one is held to: it has
    /// to say something, and to name a failure the contract knows.
    /// </summary>
    [Fact]
    public Task A_revision_that_says_nothing_is_refused() => RunTestAsync(async service =>
    {
        // A note to revise
        var note = await service.CreateAsync(
            _reviewerId, _sessionId, _replyId, "she gave it away", Category.GaveAway);

        // Whitespace is the same as saying nothing
        await Assert.ThrowsAsync<AdminNoteValueException>(() =>
            service.UpdateAsync(_reviewerId, note.Id, "   ", null));

        // A failure outside the ones the contract names can't reach the column
        await Assert.ThrowsAsync<AdminNoteValueException>(() =>
            service.UpdateAsync(_reviewerId, note.Id, "something", (Category)99));

        // And neither refusal touched what it says
        await QueryAsync(async context => Assert.Equal(
            "she gave it away",
            await context.AdminNotes.Where(stored => stored.Id == note.Id)
                .Select(stored => stored.Content)
                .SingleAsync()));
    });

    /// <summary>
    /// A note against a reply dies with that reply, but one against the whole conversation outlives a rewind: the
    /// first is unreadable without what it was about, the second was never about a reply at all.
    /// </summary>
    [Fact]
    public Task A_rewind_takes_the_notes_against_the_replies_it_drops() => RunTestAsync(async service =>
    {
        // One note against the reply, one against the conversation
        await service.CreateAsync(_reviewerId, _sessionId, _replyId, "she gave it away", null);
        await service.CreateAsync(_reviewerId, _sessionId, null, "went in circles", null);

        // The student rewinds past the reply
        await QueryAsync(context => context.DefenseTurns
            .Where(turn => turn.SessionId == _sessionId && turn.Sequence >= ReplySequence)
            .ExecuteDeleteAsync());

        // What is left of the notes
        await QueryAsync(async context =>
        {
            // Only one, the other having gone with the reply it was about
            var note = Assert.Single(await context.AdminNotes.ToListAsync());

            // And it is the one about the conversation
            Assert.Equal("went in circles", note.Content);
        });
    });

    /// <summary>
    /// Deleting a conversation takes everything written about it, replies and whole-conversation notes alike,
    /// along with the record of it having been read.
    /// </summary>
    [Fact]
    public Task Deleting_a_conversation_takes_everything_written_about_it() => RunTestAsync(async service =>
    {
        // Two notes about it
        await service.CreateAsync(_reviewerId, _sessionId, _replyId, "she gave it away", null);
        await service.CreateAsync(_reviewerId, _sessionId, null, "went in circles", null);

        // And a record of having read it
        await QueryAsync(async context =>
        {
            // The reviewer's stamp on it
            context.AdminSessionReviews.Add(
                new AdminSessionReview
                {
                    SessionId = _sessionId,
                    ReviewerId = _reviewerId,
                    ReadAt = DateTimeOffset.UtcNow,
                });

            // Commit it
            await context.SaveChangesAsync();
        });

        // The student deletes the conversation
        await QueryAsync(context =>
            context.DefenseSessions.Where(session => session.Id == _sessionId).ExecuteDeleteAsync());

        // What is left behind
        await QueryAsync(async context =>
        {
            // Nothing written about it
            Assert.Empty(await context.AdminNotes.ToListAsync());

            // And no record of having read it
            Assert.Empty(await context.AdminSessionReviews.ToListAsync());
        });
    });

    /// <summary>
    /// A note that isn't there can't be revised, dropped, or settled, rather than passing for done.
    /// </summary>
    [Fact]
    public Task A_missing_note_is_refused_by_every_write() => RunTestAsync(async service =>
    {
        // An id nothing was written under
        var missingId = Guid.NewGuid();

        // Revising it
        await Assert.ThrowsAsync<AdminNoteNotFoundException>(() =>
            service.UpdateAsync(_reviewerId, missingId, "something", null));

        // Dropping it
        await Assert.ThrowsAsync<AdminNoteNotFoundException>(() => service.DeleteAsync(_reviewerId, missingId));

        // And settling it
        await Assert.ThrowsAsync<AdminNoteNotFoundException>(() =>
            service.SetResolvedAsync(missingId, resolved: true));
    });

    /// <summary>
    /// Dropping a note takes the one it names and leaves every other reading of the conversation standing, since
    /// each was said separately.
    /// </summary>
    [Fact]
    public Task The_author_drops_the_one_note_they_name() => RunTestAsync(async service =>
    {
        // Two notes the same reviewer wrote
        var dropped = await service.CreateAsync(
            _reviewerId, _sessionId, _replyId, "she gave it away", Category.GaveAway);
        await service.CreateAsync(_reviewerId, _sessionId, null, "went in circles", null);

        // Drop the first
        await service.DeleteAsync(_reviewerId, dropped.Id);

        // What is left of the two
        await QueryAsync(async context =>
        {
            // Only one, the drop having reached the other
            var note = Assert.Single(await context.AdminNotes.ToListAsync());

            // And it is the one nobody named
            Assert.Equal("went in circles", note.Content);
        });
    });

    /// <summary>
    /// A note is its author's own reading of a conversation, so only they may rewrite or drop it. Settling one is
    /// a judgement about the conversation rather than a change to what somebody wrote, so that stays open to all.
    /// </summary>
    [Fact]
    public Task Only_the_author_can_revise_or_drop_a_note() => RunTestAsync(async service =>
    {
        // A note one reviewer wrote
        var note = await service.CreateAsync(
            _reviewerId, _sessionId, _replyId, "she gave it away", Category.GaveAway);

        // The other reviewer may not rewrite it
        await Assert.ThrowsAsync<NotAdminNoteAuthorException>(() =>
            service.UpdateAsync(_otherReviewerId, note.Id, "actually she was right", null));

        // Nor drop it
        await Assert.ThrowsAsync<NotAdminNoteAuthorException>(() =>
            service.DeleteAsync(_otherReviewerId, note.Id));

        // And neither refusal touched what it says
        await QueryAsync(async context => Assert.Equal(
            "she gave it away",
            await context.AdminNotes.Where(stored => stored.Id == note.Id)
                .Select(stored => stored.Content)
                .SingleAsync()));

        // Settling it is open to them, since it says nothing in their name
        await service.SetResolvedAsync(note.Id, resolved: true);

        // It reads as settled
        await QueryAsync(async context => Assert.NotNull(
            await context.AdminNotes.Where(stored => stored.Id == note.Id)
                .Select(stored => stored.ResolvedAt)
                .SingleAsync()));
    });

    /// <summary>
    /// Authorship travels with the note so the surface can tell whose it is without holding an identity of its own.
    /// </summary>
    [Fact]
    public Task The_feed_says_which_notes_the_reader_wrote() => RunTestAsync(async service =>
    {
        // One note from each reviewer
        await service.CreateAsync(_reviewerId, _sessionId, null, "mine", null);
        await service.CreateAsync(_otherReviewerId, _sessionId, null, "theirs", null);

        // Read back as the first reviewer
        var feed = await service.GetFeedAsync(_reviewerId, openOnly: false, 1);

        // Only their own comes back as theirs to change
        Assert.Equal(
            [("theirs", false), ("mine", true)],
            feed.Items.Select(item => (item.Note.Content, item.Note.IsOwn)));
    });

    /// <summary>
    /// A conversation that has lost its problem stays out of the feed whole, count included: opening one takes a
    /// problem, so a line about it would lead nowhere.
    /// </summary>
    [Fact]
    public Task The_feed_leaves_out_a_conversation_with_no_problem_behind_it() => RunTestAsync(async service =>
    {
        // A note about the conversation that still has its problem
        await service.CreateAsync(_reviewerId, _sessionId, null, "went in circles", null);

        // And one about the conversation that has none
        await service.CreateAsync(_reviewerId, _untargetedSessionId, null, "nowhere to open", null);

        // Read the feed
        var feed = await service.GetFeedAsync(_reviewerId, openOnly: false, 1);

        // Which carries the one note that can be followed back
        Assert.Equal("went in circles", Assert.Single(feed.Items).Note.Content);

        // And counts it alone, so the pager promises no line it won't serve
        Assert.Equal(1, feed.TotalCount);
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
            await service.CreateAsync(_reviewerId, _sessionId, null, "first", null);
            await service.CreateAsync(_reviewerId, _sessionId, null, "second", null);
            await service.CreateAsync(_reviewerId, _sessionId, null, "third", null);

            // Ask for the first page
            var first = await service.GetFeedAsync(_reviewerId, openOnly: false, 1);

            // And for the rest
            var second = await service.GetFeedAsync(_reviewerId, openOnly: false, 2);

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
    /// Builds one seeded conversation.
    /// </summary>
    /// <param name="sessionId">The conversation's identifier.</param>
    /// <returns>The conversation, ready to add.</returns>
    private static DefenseSession NewSession(Guid sessionId) => new()
    {
        Id = sessionId,
        UserId = _studentId,
        ProblemStatement = "a problem",
        ProblemReference = "a reference",
        ExaminerConfig = "{}",
        CreatedAt = DateTimeOffset.UtcNow,
    };

    /// <summary>
    /// Builds one seeded turn.
    /// </summary>
    /// <param name="turnId">The turn's identifier.</param>
    /// <param name="sessionId">The conversation the turn belongs to.</param>
    /// <param name="role">Who authored the turn.</param>
    /// <param name="content">The turn's text.</param>
    /// <param name="sequence">The turn's position in the conversation.</param>
    /// <returns>The turn, ready to add.</returns>
    private static DefenseTurn NewTurn(
        Guid turnId, Guid sessionId, TranscriptRole role, string content, int sequence) => new()
        {
            Id = turnId,
            SessionId = sessionId,
            Role = role,
            Content = content,
            Sequence = sequence,
            CreatedAt = DateTimeOffset.UtcNow,
        };
}

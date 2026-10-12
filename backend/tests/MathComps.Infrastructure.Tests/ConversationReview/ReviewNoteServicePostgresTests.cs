using MathComps.Domain.EfCoreEntities;
using Category = MathComps.Domain.EfCoreEntities.DefenseReportCategory;
using MathComps.Infrastructure.Services.ConversationReview;
using MathComps.Infrastructure.Services.Defense;
using MathComps.Infrastructure.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;
using static MathComps.Infrastructure.Tests.ConversationReview.ReviewNoteSeed;

namespace MathComps.Infrastructure.Tests.ConversationReview;

/// <summary>
/// Integration tests for <see cref="ReviewNoteService"/> against a real PostgreSQL database: what a note refuses to
/// be written or revised as, that only its author rewrites or drops it, and the deletion rules the storage design
/// turns on — a note against a reply dies with that reply, one against the conversation outlives a rewind, and both
/// die with the conversation.
/// </summary>
/// <param name="fixture">The shared PostgreSQL container fixture.</param>
public class ReviewNoteServicePostgresTests(PostgresContainerFixture fixture)
    : ReviewNotePostgresTestBase<IReviewNoteService>(fixture)
{
    /// <summary>
    /// Several notes can stand against one reply, since a reply can be wrong in more than one way and each is
    /// worth saying separately.
    /// </summary>
    [Fact]
    public Task Notes_against_one_reply_accumulate() => RunTestAsync(async service =>
    {
        // Say one thing about the reply
        await service.CreateAsync(ReviewerId, SessionId, ReplyId, "she gave it away", Category.GaveAway);

        // Then another
        await service.CreateAsync(ReviewerId, SessionId, ReplyId, "and was curt", Category.Tone);

        // Both stand, rather than the second replacing the first
        await QueryAsync(async context =>
            Assert.Equal(2, await context.AdminNotes.CountAsync(note => note.TurnId == ReplyId)));
    });

    /// <summary>
    /// A note against a reply has to be against one of its own conversation's, so a reply id from elsewhere is
    /// refused rather than quietly filed under the wrong conversation.
    /// </summary>
    [Fact]
    public Task A_note_cannot_name_another_conversations_reply() => RunTestAsync(async service =>
    {
        // Point a note about this conversation at the other one's reply
        await Assert.ThrowsAsync<ReviewNoteTargetException>(() => service.CreateAsync(
            ReviewerId, SessionId, OtherSessionReplyId, "wrong conversation", null));

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
        await Assert.ThrowsAsync<ReviewNoteValueException>(() => service.CreateAsync(
            ReviewerId, SessionId, null, "   ", null));

        // A failure outside the ones the contract names can't reach the column
        await Assert.ThrowsAsync<ReviewNoteValueException>(() => service.CreateAsync(
            ReviewerId, SessionId, null, "something", (Category)99));

        // And a conversation that isn't there has nothing to be written about
        await Assert.ThrowsAsync<DefenseSessionNotFoundException>(() => service.CreateAsync(
            ReviewerId, Guid.NewGuid(), null, "something", null));
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
            ReviewerId, SessionId, ReplyId, "she gave it away", Category.GaveAway);

        // Which reads as never revised, both its stamps being the one moment it was written
        Assert.Equal(note.CreatedAt, note.UpdatedAt);

        // What the row was written with, read back rather than compared against the in-memory stamp, which
        // carries finer ticks than the column keeps
        var writtenAt = await QueryValueAsync(context =>
            context.AdminNotes.Where(stored => stored.Id == note.Id).Select(stored => stored.CreatedAt).SingleAsync());

        // Revise it, naming no failure this time
        var revised = await service.UpdateAsync(ReviewerId, note.Id, "actually she was right", null);

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
            ReviewerId, SessionId, ReplyId, "she gave it away", Category.GaveAway);

        // Whitespace is the same as saying nothing
        await Assert.ThrowsAsync<ReviewNoteValueException>(() =>
            service.UpdateAsync(ReviewerId, note.Id, "   ", null));

        // A failure outside the ones the contract names can't reach the column
        await Assert.ThrowsAsync<ReviewNoteValueException>(() =>
            service.UpdateAsync(ReviewerId, note.Id, "something", (Category)99));

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
        await service.CreateAsync(ReviewerId, SessionId, ReplyId, "she gave it away", null);
        await service.CreateAsync(ReviewerId, SessionId, null, "went in circles", null);

        // The student rewinds past the reply
        await QueryAsync(context => context.DefenseTurns
            .Where(turn => turn.SessionId == SessionId && turn.Sequence >= ReplySequence)
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
        await service.CreateAsync(ReviewerId, SessionId, ReplyId, "she gave it away", null);
        await service.CreateAsync(ReviewerId, SessionId, null, "went in circles", null);

        // And a record of having read it
        await QueryAsync(async context =>
        {
            // The reviewer's stamp on it
            context.AdminSessionReviews.Add(
                new AdminSessionReview
                {
                    SessionId = SessionId,
                    ReviewerId = ReviewerId,
                    ReadAt = DateTimeOffset.UtcNow,
                });

            // Commit it
            await context.SaveChangesAsync();
        });

        // The student deletes the conversation
        await QueryAsync(context =>
            context.DefenseSessions.Where(session => session.Id == SessionId).ExecuteDeleteAsync());

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
        await Assert.ThrowsAsync<ReviewNoteNotFoundException>(() =>
            service.UpdateAsync(ReviewerId, missingId, "something", null));

        // Dropping it
        await Assert.ThrowsAsync<ReviewNoteNotFoundException>(() => service.DeleteAsync(ReviewerId, missingId));

        // And settling it
        await Assert.ThrowsAsync<ReviewNoteNotFoundException>(() =>
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
            ReviewerId, SessionId, ReplyId, "she gave it away", Category.GaveAway);
        await service.CreateAsync(ReviewerId, SessionId, null, "went in circles", null);

        // Drop the first
        await service.DeleteAsync(ReviewerId, dropped.Id);

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
            ReviewerId, SessionId, ReplyId, "she gave it away", Category.GaveAway);

        // The other reviewer may not rewrite it
        await Assert.ThrowsAsync<NotReviewNoteAuthorException>(() =>
            service.UpdateAsync(OtherReviewerId, note.Id, "actually she was right", null));

        // Nor drop it
        await Assert.ThrowsAsync<NotReviewNoteAuthorException>(() =>
            service.DeleteAsync(OtherReviewerId, note.Id));

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
}

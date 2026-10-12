using MathComps.Domain.Contracts.Defense;
using MathComps.Domain.EfCoreEntities;
using MathComps.Domain.Localization;
using MathComps.Infrastructure.Services.ConversationReview;
using MathComps.Infrastructure.Services.Defense;
using MathComps.Infrastructure.Tests.TestInfrastructure;
using static MathComps.Infrastructure.Tests.ConversationReview.ConversationReviewSeed;

namespace MathComps.Infrastructure.Tests.ConversationReview;

/// <summary>
/// Integration tests for <see cref="ConversationReviewService"/> against a real PostgreSQL database: that a
/// conversation reads back whole, with the drafts behind each reply, what its author said about it and its own notes
/// alone, that an archive problem is named by where it comes from, and that a conversation that isn't there can't be
/// read or marked.
/// </summary>
/// <param name="fixture">The shared PostgreSQL container fixture.</param>
public class ConversationReviewServicePostgresTests(PostgresContainerFixture fixture)
    : ConversationReviewPostgresTestBase<IConversationReviewService>(fixture)
{
    /// <summary>
    /// The whole conversation reads back with everything the examiner held: the problem and its reference, the
    /// settings snapshot as readable json rather than a string, the turns in the order they were said, and the
    /// student's verdict on all of it.
    /// </summary>
    [Fact]
    public Task The_detail_carries_the_whole_conversation_and_what_it_ran_on() => RunTestAsync(async service =>
    {
        // Read the conversation the student answered for
        var detail = await service.GetDetailAsync(ReviewerId, OldestSessionId, Language.EN);

        // Everything the examiner was working from
        Assert.Equal("a problem", detail.Statement);
        Assert.Equal("a reference", detail.Reference);

        // Its settings snapshot reads as json, still holding the model the conversation ran on. Reading a property
        // off it here is what says the element outlived the document it was parsed out of
        Assert.Equal(
            "gemini-3.6-flash",
            detail.ExaminerConfig.GetProperty("generate").GetProperty("model").GetString());

        // The turns come back in the order they were said, the examiner's opener ahead of the student's answer
        Assert.Equal(
            ["the opener", "my oldest defense"],
            detail.Turns.Select(turn => turn.Content));

        // Along with what the student made of the conversation as a whole
        Assert.Equal(DefenseOutcome.FoundTheMistake, detail.Feedback?.Outcome);
    });

    /// <summary>
    /// The detail carries every draft behind a reply, attributed to the reply it was made for and in the order it was
    /// drafted, each with the calls that wrote and judged it. The review surface groups them by reply and reads the
    /// last of a group as the one the student saw, so an attribution or an order that slipped would tell a false
    /// story about what the examiner did.
    /// </summary>
    [Fact]
    public Task The_detail_carries_every_draft_behind_a_reply() => RunTestAsync(async service =>
    {
        // Read the conversation whose last reply took two drafts
        var detail = await service.GetDetailAsync(ReviewerId, NewestSessionId, Language.EN);

        // Both came back in the order they were drafted
        Assert.Equal(["her leaky draft", "her reply"], detail.Attempts.Select(attempt => attempt.Reply));

        // Each against the reply it was made for, which is what the surface groups them by
        Assert.All(detail.Attempts, attempt => Assert.Equal(NewestReplyId, attempt.TurnId));

        // The rejected one carries what the guard caught, the part the student never saw
        Assert.True(detail.Attempts[0].Leaks);
        Assert.Equal("the counterexample", detail.Attempts[0].WhatLeaked);

        // And each carries the calls it made, which the turn's single figure can't break down
        Assert.All(
            detail.Attempts,
            attempt => Assert.Equal(
                [ExaminerStep.Generate, ExaminerStep.LeakCheck],
                attempt.Calls.Select(call => call.Step).Order()));

        // Along with how long each draft and each of its calls took, the axis a slow reply is traced along
        Assert.Equal(AttemptDurationsMs, detail.Attempts.Select(attempt => attempt.DurationMs));
        Assert.All(
            detail.Attempts.SelectMany(attempt => attempt.Calls),
            call => Assert.Equal(CallDurationMs, call.DurationMs));
    });

    /// <summary>
    /// The detail carries what the student held against a reply, standing against that reply.
    /// </summary>
    [Fact]
    public Task The_detail_carries_what_the_student_reported_on_a_reply() => RunTestAsync(async service =>
    {
        // Read the conversation whose last reply the student reported
        var detail = await service.GetDetailAsync(ReviewerId, NewestSessionId, Language.EN);

        // Its one report
        var report = Assert.Single(detail.Reports);

        // Standing against the reply
        Assert.Equal(NewestReplyId, report.TurnId);

        // Saying what they held against it
        Assert.Equal([DefenseReportCategory.GaveAway], report.Categories);

        // In their own words too
        Assert.Equal("she just told me", report.Comment);
    });

    /// <summary>
    /// A conversation held before the drafts were kept reads back holding none, rather than failing on their absence.
    /// Every conversation already in the database is one of those, so the empty case is the ordinary one for a while
    /// yet, and it has to reach the review surface as "nothing to show" rather than as an error.
    /// </summary>
    [Fact]
    public Task The_detail_holds_no_drafts_for_a_conversation_from_before_they_were_kept() =>
        RunTestAsync(async service =>
    {
        // Read a conversation seeded with turns and nothing recorded behind them
        var detail = await service.GetDetailAsync(ReviewerId, OldestSessionId, Language.EN);

        // Its turns came back, and it simply holds no drafts
        Assert.NotEmpty(detail.Turns);
        Assert.Empty(detail.Attempts);
    });

    /// <summary>
    /// The detail carries the notes written about that conversation and no others, newest first, each marked as the
    /// reading reviewer's own or somebody else's.
    /// </summary>
    [Fact]
    public Task The_detail_carries_only_its_own_notes_newest_first() => RunTestAsync(async service =>
    {
        // Two readings of one conversation by different reviewers, and one of another, so a note that belongs
        // elsewhere has somewhere to leak in from
        await QueryAsync(async context =>
        {
            // The three notes, stamped apart so newest-first has an order to hold
            context.AdminNotes.AddRange(
                NewNote(ReviewerId, NewestSessionId, "my earlier reading", Now.AddHours(-2)),
                NewNote(OtherReviewerId, NewestSessionId, "a second opinion", Now.AddHours(-1)),
                NewNote(ReviewerId, NewerSessionId, "about a different conversation", Now.AddHours(-3)));

            // Commit them
            await context.SaveChangesAsync();
        });

        // Read the conversation the first two were written about
        var detail = await service.GetDetailAsync(ReviewerId, NewestSessionId, Language.EN);

        // Only its own two come back, the later reading ahead of the earlier
        Assert.Equal(
            ["a second opinion", "my earlier reading"],
            detail.Notes.Select(note => note.Content));

        // Each under whoever wrote it
        Assert.Equal(
            ["Second reviewer", "Reviewer"],
            detail.Notes.Select(note => note.Author.Username));

        // And marked as the reading reviewer's own only where they are the author
        Assert.Equal([false, true], detail.Notes.Select(note => note.IsOwn));
    });

    /// <summary>
    /// Opening a competition conversation names its problem the same way the queue does. The detail builds its
    /// own projection over the same columns, so the queue naming one is no evidence that the modal does.
    /// </summary>
    [Fact]
    public Task The_detail_of_an_archive_conversation_names_where_its_problem_comes_from() =>
        RunTestAsync(async service =>
        {
            // The competition conversation, read in full
            var detail = await service.GetDetailAsync(ReviewerId, ArchiveSessionId, Language.EN);

            // Which names an archive problem rather than a handout one
            var target = Assert.IsType<NamedProblemTarget>(detail.Target);
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
    /// A conversation that isn't there can't be read or marked, rather than quietly passing for done.
    /// </summary>
    [Fact]
    public Task A_missing_conversation_is_refused_by_every_read_and_mark() => RunTestAsync(async service =>
    {
        // An id nothing was seeded under
        var missingId = Guid.Parse("00000000-0000-0000-0000-0000000000ff");

        // Reading it
        await Assert.ThrowsAsync<DefenseSessionNotFoundException>(
            () => service.GetDetailAsync(ReviewerId, missingId, Language.EN));

        // Marking it read
        await Assert.ThrowsAsync<DefenseSessionNotFoundException>(
            () => service.MarkReadAsync(ReviewerId, missingId));

        // Putting it back to unread
        await Assert.ThrowsAsync<DefenseSessionNotFoundException>(
            () => service.MarkUnreadAsync(ReviewerId, missingId));

        // And picking it up from a turn, which is refused for the conversation before the turn is looked at
        await Assert.ThrowsAsync<DefenseSessionNotFoundException>(
            () => service.MarkUnreadFromAsync(ReviewerId, missingId, NewestReplyId));
    });
}

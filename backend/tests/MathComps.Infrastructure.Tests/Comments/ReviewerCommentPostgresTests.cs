using System.Collections.Immutable;
using MathComps.Domain.Contracts.Comments;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Extensions;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Comments;
using MathComps.Infrastructure.Tests.TestInfrastructure;
using Microsoft.Extensions.DependencyInjection;
using static MathComps.Infrastructure.Tests.TestInfrastructure.HostedSeed;

namespace MathComps.Infrastructure.Tests.Comments;

/// <summary>
/// Integration tests for a kind of discussion open only to the reviewers, the members of the organization whose
/// selection holds what it hangs off, as <see cref="ICommentService"/> keeps it against a real PostgreSQL database:
/// that those accounts read it, write and react in it and count it, that nobody else reaches it, a member of another
/// organization included, and a refusal reads like a thread that is not there, and that each subject keeps its own
/// discussion. How far each reviewer has seen a discussion is kept by <see cref="ICommentSeenService"/>. A derived
/// class names the kind and seeds two of its subjects, both MathComps'.
/// </summary>
/// <param name="fixture">The shared PostgreSQL container fixture.</param>
public abstract class ReviewerCommentPostgresTests(PostgresContainerFixture fixture)
    : PostgresTestBase<ICommentService>(fixture)
{
    /// <summary>
    /// A reviewer, whose address is on the MathComps organization's list.
    /// </summary>
    protected CommentViewer Reviewer { get; } = new(Guid.CreateVersion7(), IsAdmin: false);

    /// <summary>
    /// A second reviewer, since every reviewer writes in the discussion.
    /// </summary>
    protected CommentViewer OtherReviewer { get; } = new(Guid.CreateVersion7(), IsAdmin: false);

    /// <summary>
    /// An admin who is no reviewer.
    /// </summary>
    private readonly CommentViewer _admin = new(Guid.CreateVersion7(), IsAdmin: true);

    /// <summary>
    /// A student, who is no reviewer and does not administer the site.
    /// </summary>
    protected CommentViewer Student { get; } = new(Guid.CreateVersion7(), IsAdmin: false);

    /// <summary>
    /// A member of the olympiad's commission, on its list alone.
    /// </summary>
    private readonly CommentViewer _commissioner = new(Guid.CreateVersion7(), IsAdmin: false);

    /// <summary>
    /// The subject discussed.
    /// </summary>
    protected Guid SubjectId { get; set; }

    /// <summary>
    /// Another subject of the same kind, with a discussion of its own.
    /// </summary>
    protected Guid OtherSubjectId { get; set; }

    /// <summary>
    /// The kind of discussion under test.
    /// </summary>
    protected abstract CommentTargetType TargetType { get; }

    /// <inheritdoc/>
    protected override void ConfigureServices(IServiceCollection services) =>
        // Register the user services module the test resolves from
        services.AddUserServices();

    /// <summary>
    /// A reviewer writes in a discussion and another answers. An edit keeps the answer under the comment, and the
    /// other reviewer reacts to the edited comment.
    /// </summary>
    [Fact]
    public Task Reviewers_write_edit_react_and_read_a_discussion() => RunTestAsync(async service =>
    {
        // The discussion of the subject
        var target = Discussion(SubjectId);

        // A reviewer says what the subject lacks
        var comment = await service.CreateCommentAsync(target, Reviewer, "Too easy for the slot.");

        // Another reviewer answers
        var reply = await service.CreateCommentAsync(target, OtherReviewer, "Move it, then.", comment.Id);

        // The first reviewer sharpens the comment
        var edited = await service.UpdateCommentAsync(comment.Id, Reviewer, "Far too easy for the slot.");

        // The second reviewer gives the edited comment a thumbs-up
        await service.PressReactionAsync(edited.Id, OtherReviewer, CommentReactionKind.ThumbsUp);

        // The discussion as the second reviewer reads it
        var thread = await service.GetCommentsAsync(target, OtherReviewer);

        // The edited comment, with the answer still under it
        var root = Assert.Single(thread);
        Assert.Equal(edited.Id, root.Id);
        Assert.Equal("Far too easy for the slot.", root.Content);
        Assert.Equal(reply.Id, Assert.Single(root.Replies).Id);

        // One thumbs-up on the edited comment
        Assert.Equal(CommentReactionKind.ThumbsUp, Assert.Single(root.Reactions).Kind);
    });

    /// <summary>
    /// Nobody but the reviewers reaches a discussion: not an admin, not a student, not anybody signed out. Each
    /// refusal is the one a thread or comment that is not there gets, so it confirms nothing, and the counts and the
    /// bulk read, which takes a signed-in viewer, are refused the same way.
    /// </summary>
    [Fact]
    public Task Nobody_off_the_list_reaches_a_discussion() => RunTestAsync(async service =>
    {
        // The discussion of the subject
        var target = Discussion(SubjectId);

        // A reviewer's comment in the discussion
        var comment = await service.CreateCommentAsync(target, Reviewer, "Too easy for the slot.");

        // Every caller on no organization's list
        CommentViewer?[] outsiders = [_admin, Student, null];

        // No outsider reads the discussion or counts it
        foreach (var outsider in outsiders)
        {
            // Reading, refused like a missing thread
            await Assert.ThrowsAsync<CommentTargetNotFoundException>(() => service.GetCommentsAsync(target, outsider));

            // Counting, refused the same way
            await Assert.ThrowsAsync<CommentTargetNotFoundException>(
                () => service.GetCommentCountsAsync(TargetType, [SubjectId.ToString()], outsider));
        }

        // Every signed-in caller on no organization's list
        CommentViewer[] signedIn = [_admin, Student];

        // No signed-in outsider reads the discussion in bulk, writes, edits, deletes or reacts in it
        foreach (var outsider in signedIn)
        {
            // Reading in bulk, refused like a missing thread
            await Assert.ThrowsAsync<CommentTargetNotFoundException>(
                () => service.GetThreadsAsync(TargetType, [SubjectId.ToString()], outsider));

            // A new comment, refused like a missing thread
            await Assert.ThrowsAsync<CommentTargetNotFoundException>(
                () => service.CreateCommentAsync(target, outsider, "Why?"));

            // An edit, refused like a missing comment
            await Assert.ThrowsAsync<CommentNotFoundException>(
                () => service.UpdateCommentAsync(comment.Id, outsider, "Fine as it is."));

            // A delete, refused the same way
            await Assert.ThrowsAsync<CommentNotFoundException>(() => service.DeleteCommentAsync(comment.Id, outsider));

            // A reaction, refused the same way
            await Assert.ThrowsAsync<CommentNotFoundException>(
                () => service.PressReactionAsync(comment.Id, outsider, CommentReactionKind.ThumbsUp));
        }

        // The discussion as a reviewer reads it
        var thread = await service.GetCommentsAsync(target, Reviewer);

        // Still the one comment, untouched, with no reaction on it
        var root = Assert.Single(thread);
        Assert.Equal(comment.Id, root.Id);
        Assert.False(root.IsDeleted);
        Assert.Empty(root.Reactions);
    });

    /// <summary>
    /// A member of another organization reaches none of MathComps' discussions: reading one is refused like a thread
    /// that is not there, reacting to one of its comments like a comment that is not there, and a count asked for its
    /// subject comes back with no entry for it.
    /// </summary>
    [Fact]
    public Task A_member_of_another_organization_reaches_no_discussion() => RunTestAsync(async service =>
    {
        // The discussion of the subject
        var target = Discussion(SubjectId);

        // A reviewer's comment in the discussion
        var comment = await service.CreateCommentAsync(target, Reviewer, "Too easy for the slot.");

        // Reading the discussion as the commissioner, refused like a missing thread
        await Assert.ThrowsAsync<CommentTargetNotFoundException>(() => service.GetCommentsAsync(target, _commissioner));

        // Reacting to the comment as the commissioner, refused like a missing comment
        await Assert.ThrowsAsync<CommentNotFoundException>(
            () => service.PressReactionAsync(comment.Id, _commissioner, CommentReactionKind.ThumbsUp));

        // The subject's count, as the commissioner asks for it
        var counts = await service.GetCommentCountsAsync(TargetType, [SubjectId.ToString()], _commissioner);

        // No entry for the subject
        Assert.Empty(counts);
    });

    /// <summary>
    /// A subject's count is its discussion's live comments, replies included: neither a deleted comment nor the version
    /// an edit replaced counts. A subject nobody discusses and an id naming nothing get no entry.
    /// </summary>
    [Fact]
    public Task A_discussions_count_is_its_live_comments() => RunTestAsync(async service =>
    {
        // The discussion of the subject
        var target = Discussion(SubjectId);

        // A comment that is later edited
        var edited = await service.CreateCommentAsync(target, Reviewer, "Too easy for the slot.");

        // A reply to the comment that is later edited
        await service.CreateCommentAsync(target, OtherReviewer, "Agreed.", edited.Id);

        // A comment that is later deleted
        var deleted = await service.CreateCommentAsync(target, OtherReviewer, "Fine as it is.");

        // The edit
        await service.UpdateCommentAsync(edited.Id, Reviewer, "Far too easy for the slot.");

        // The delete
        await service.DeleteCommentAsync(deleted.Id, OtherReviewer);

        // The counts of both subjects and of an id naming nothing
        var counts = await service.GetCommentCountsAsync(
            TargetType, [SubjectId.ToString(), OtherSubjectId.ToString(), "not-an-id"], Reviewer);

        // The edited comment and its reply, under the subject's id as the client spells it
        Assert.Equal(ImmutableDictionary.CreateRange([KeyValuePair.Create(SubjectId.ToString(), 2)]), counts);
    });

    /// <summary>
    /// Several discussions read at once come back each as it reads alone: the edited comment with its reply and its
    /// reaction, a deleted comment emptied, each under its subject's id as the client spells it. An id naming nothing
    /// and one that is no GUID get no entry. The bulk read starts from the comments linked to the threads asked for,
    /// where the single read starts from the thread's own link, so a read that started from a replaced version or lost
    /// a reply would differ from the single one.
    /// </summary>
    [Fact]
    public Task Discussions_read_at_once_read_as_each_reads_alone() => RunTestAsync(async service =>
    {
        // The discussions of both subjects
        var target = Discussion(SubjectId);
        var otherTarget = Discussion(OtherSubjectId);

        // A comment that is later edited
        var edited = await service.CreateCommentAsync(target, Reviewer, "Too easy for the slot.");

        // A reply to the comment that is later edited
        await service.CreateCommentAsync(target, OtherReviewer, "Agreed.", edited.Id);

        // The edit
        var newVersion = await service.UpdateCommentAsync(edited.Id, Reviewer, "Far too easy for the slot.");

        // A thumbs-up on the edited comment
        await service.PressReactionAsync(newVersion.Id, OtherReviewer, CommentReactionKind.ThumbsUp);

        // A comment that is later deleted
        var deleted = await service.CreateCommentAsync(target, OtherReviewer, "Fine as it is.");

        // The delete
        await service.DeleteCommentAsync(deleted.Id, OtherReviewer);

        // A comment about the other subject
        await service.CreateCommentAsync(otherTarget, OtherReviewer, "Better in the advanced paper.");

        // Both discussions read alone
        var alone = await service.GetCommentsAsync(target, Reviewer);
        var otherAlone = await service.GetCommentsAsync(otherTarget, Reviewer);

        // Both discussions read at once, beside an id naming nothing and one that is no GUID
        var atOnce = await service.GetThreadsAsync(
            TargetType,
            [SubjectId.ToString(), OtherSubjectId.ToString(), Guid.CreateVersion7().ToString(), "not-an-id"],
            Reviewer);

        // Only the two subjects anything was said about
        Assert.Equal(new[] { SubjectId.ToString(), OtherSubjectId.ToString() }.Order(), atOnce.Keys.Order());

        // Each discussion as it reads alone
        Assert.Equivalent(alone, atOnce[SubjectId.ToString()], strict: true);
        Assert.Equivalent(otherAlone, atOnce[OtherSubjectId.ToString()], strict: true);

        // The subject's top-level comments in the order they read alone
        Assert.Equal(alone.Select(comment => comment.Id), atOnce[SubjectId.ToString()].Select(comment => comment.Id));
    });

    /// <summary>
    /// How far a reviewer has seen a discussion reads as their mark beside when somebody else last posted in it. A
    /// reply counts, while the reviewer's own comments never do, nor does a deleted one, and an edit keeps the moment
    /// its comment was first posted. An earlier mark written later leaves the mark where it is. Another reviewer's mark
    /// stays theirs: the other subject, which the reviewer never saw and nobody posted in, reads as neither seen nor
    /// posted in. A caller on no organization's list is refused.
    /// </summary>
    [Fact]
    public Task A_discussion_reads_as_seen_up_to_its_mark_beside_others_last_post() => RunTestAsync(async service =>
    {
        // The discussion of the subject
        var target = Discussion(SubjectId);

        // The other reviewer's comment
        var answered = await service.CreateCommentAsync(target, OtherReviewer, "Too easy for the slot.");

        // The other reviewer's reply under their comment, the newest thing they post that stands, later edited
        var reply = await service.CreateCommentAsync(target, OtherReviewer, "Unless it goes first.", answered.Id);

        // The other reviewer's comment, later deleted
        var deleted = await service.CreateCommentAsync(target, OtherReviewer, "Fine as it is.");

        // The reviewer's own comment, the newest of all
        await service.CreateCommentAsync(target, Reviewer, "Agreed.");

        // The edit of the reply, made after everything was posted
        await service.UpdateCommentAsync(reply.Id, OtherReviewer, "Unless it goes last.");

        // The delete
        await service.DeleteCommentAsync(deleted.Id, OtherReviewer);

        // The moment the reviewer has seen the discussion up to, as precise as the database keeps it
        var seenUpTo = DateTimeOffset.UtcNow.TruncateToMicroseconds();

        // The marks, and the read through the service keeping them
        await QueryAsync<ICommentSeenService>(async (_, seen) =>
        {
            // The reviewer's mark on the subject
            await seen.MarkSeenAsync(TargetType, [SubjectId.ToString()], Reviewer, seenUpTo);

            // A second mark by the reviewer, a minute earlier, as a stale view would write it
            await seen.MarkSeenAsync(TargetType, [SubjectId.ToString()], Reviewer, seenUpTo.AddMinutes(-1));

            // The other reviewer's mark on the other subject
            await seen.MarkSeenAsync(TargetType, [OtherSubjectId.ToString()], OtherReviewer, seenUpTo);

            // Both subjects as the reviewer reads them
            var states = await seen.GetSeenAsync(
                TargetType, [SubjectId.ToString(), OtherSubjectId.ToString()], Reviewer);

            // The discussion as the reviewer reads it
            var thread = await service.GetCommentsAsync(target, Reviewer);

            // When the reply was first posted, as the database keeps it
            var replyPostedAt = Assert.Single(thread.Single(comment => comment.Id == answered.Id).Replies).CreatedAt;

            // The subject seen up to the mark and last posted in by the reply, the other subject by neither
            Assert.Equal(
                ImmutableDictionary.CreateRange(
                [
                    KeyValuePair.Create(SubjectId.ToString(), new CommentThreadSeenDto(seenUpTo, replyPostedAt)),
                    KeyValuePair.Create(OtherSubjectId.ToString(), new CommentThreadSeenDto(null, null)),
                ]),
                states);

            // The student, refused like a missing thread
            await Assert.ThrowsAsync<CommentTargetNotFoundException>(
                () => seen.GetSeenAsync(TargetType, [SubjectId.ToString()], Student));
        });
    });

    /// <summary>
    /// Each subject keeps its own discussion: what is said about one never shows under the other.
    /// </summary>
    [Fact]
    public Task Each_subject_keeps_its_own_discussion() => RunTestAsync(async service =>
    {
        // A comment on the first subject
        await service.CreateCommentAsync(Discussion(SubjectId), Reviewer, "Too easy for the slot.");

        // The other subject's discussion as a reviewer reads it
        var otherThread = await service.GetCommentsAsync(Discussion(OtherSubjectId), Reviewer);

        // Nothing in it
        Assert.Empty(otherThread);
    });

    /// <summary>
    /// A discussion exists only for a subject: a reviewer naming an id no subject has is refused like a thread that is
    /// not there.
    /// </summary>
    [Fact]
    public Task A_discussion_of_nothing_is_refused() => RunTestAsync(async service =>
    {
        // A discussion naming nothing
        var target = Discussion(Guid.CreateVersion7());

        // Reading, refused like a missing thread
        await Assert.ThrowsAsync<CommentTargetNotFoundException>(() => service.GetCommentsAsync(target, Reviewer));

        // Writing, refused the same way
        await Assert.ThrowsAsync<CommentTargetNotFoundException>(
            () => service.CreateCommentAsync(target, Reviewer, "Fits somewhere."));
    });

    /// <inheritdoc/>
    protected override async Task SeedDataAsync(MathCompsDbContext context)
    {
        // The reviewers, the admin, the student and the commissioner
        context.Users.AddRange(
            NewUser(Reviewer.UserId, "Reviewer"),
            NewUser(OtherReviewer.UserId, "OtherReviewer"),
            NewUser(_admin.UserId, "Admin"),
            NewUser(Student.UserId, "Student"),
            NewUser(_commissioner.UserId, "Commissioner"));

        // Each reviewer's address on the MathComps organization's list
        SelectionSeed.NewMember(context, "reviewer@example.com", DateTimeOffset.UtcNow);
        SelectionSeed.NewMember(context, "otherreviewer@example.com", DateTimeOffset.UtcNow);

        // Another organization, the olympiad
        var olympiadId = SelectionSeed.NewOrganization(context, "olympiad");

        // The commissioner's address on the olympiad's list alone
        SelectionSeed.NewMember(context, olympiadId, "commissioner@example.com", DateTimeOffset.UtcNow);

        // The two subjects
        SeedSubjects(context);

        // Save seeded data
        await context.SaveChangesAsync();
    }

    /// <summary>
    /// Tracks the two subjects the tests discuss, setting <see cref="SubjectId"/> and <see cref="OtherSubjectId"/>.
    /// </summary>
    /// <param name="context">The seeding context.</param>
    protected abstract void SeedSubjects(MathCompsDbContext context);

    /// <summary>
    /// Names a subject's discussion, the way the client names it.
    /// </summary>
    /// <param name="subjectId">The subject.</param>
    /// <returns>The discussion's target.</returns>
    protected CommentTarget Discussion(Guid subjectId) =>
        // Keyed by the subject's id
        new(TargetType, subjectId.ToString());
}

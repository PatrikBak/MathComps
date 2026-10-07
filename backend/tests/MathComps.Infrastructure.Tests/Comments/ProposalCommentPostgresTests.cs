using System.Collections.Immutable;
using MathComps.Domain.Contracts.Comments;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Extensions;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Comments;
using MathComps.Infrastructure.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using static MathComps.Infrastructure.Tests.TestInfrastructure.HostedSeed;

namespace MathComps.Infrastructure.Tests.Comments;

/// <summary>
/// Integration tests for a proposal's discussion, the reviewers' thread about one problem of the problem selection,
/// as <see cref="ICommentService"/> keeps it against a real PostgreSQL database: that the accounts preparing the
/// competitions read, write and count it, that nobody else reaches it and a refusal reads like a thread that is not
/// there, that it closes once the proposal is deleted, that the problem has no public thread beside it, and that it
/// takes no likes.
/// </summary>
/// <param name="fixture">The shared PostgreSQL container fixture.</param>
public class ProposalCommentPostgresTests(PostgresContainerFixture fixture)
    : PostgresTestBase<ICommentService>(fixture)
{
    /// <summary>
    /// A reviewer preparing the competitions.
    /// </summary>
    private readonly CommentViewer _reviewer = new(Guid.CreateVersion7(), IsAdmin: false);

    /// <summary>
    /// A second reviewer, since anybody preparing the competitions writes in the discussion.
    /// </summary>
    private readonly CommentViewer _otherReviewer = new(Guid.CreateVersion7(), IsAdmin: false);

    /// <summary>
    /// An admin who does not prepare the competitions.
    /// </summary>
    private readonly CommentViewer _admin = new(Guid.CreateVersion7(), IsAdmin: true);

    /// <summary>
    /// A student, who neither prepares the competitions nor administers the site.
    /// </summary>
    private readonly CommentViewer _student = new(Guid.CreateVersion7(), IsAdmin: false);

    /// <summary>
    /// The proposal discussed.
    /// </summary>
    private Guid _proposalId;

    /// <summary>
    /// Another proposal in the pool, which nobody discusses.
    /// </summary>
    private Guid _otherProposalId;

    /// <inheritdoc/>
    protected override void ConfigureServices(IServiceCollection services) =>
        // Register the user services module the test resolves from
        services.AddUserServices();

    /// <summary>
    /// A reviewer writes in a proposal's discussion and reads it back, and so does any other reviewer. An edit keeps
    /// the reply written under the comment.
    /// </summary>
    [Fact]
    public Task Reviewers_write_edit_and_read_a_proposals_discussion() => RunTestAsync(async service =>
    {
        // The discussion of the proposal
        var target = Discussion(_proposalId);

        // A reviewer says where it fits
        var comment = await service.CreateCommentAsync(target, _reviewer, "Fits the advanced paper.");

        // Another reviewer answers
        var reply = await service.CreateCommentAsync(target, _otherReviewer, "Or the intermediate one.", comment.Id);

        // The first reviewer fixes a typo
        var edited = await service.UpdateCommentAsync(comment.Id, _reviewer, "Fits the advanced paper!");

        // The discussion as the second reviewer reads it
        var thread = await service.GetCommentsAsync(target, _otherReviewer);

        // The edited comment, with the answer still under it
        var root = Assert.Single(thread);
        Assert.Equal(edited.Id, root.Id);
        Assert.Equal("Fits the advanced paper!", root.Content);
        Assert.Equal(reply.Id, Assert.Single(root.Replies).Id);
    });

    /// <summary>
    /// Nobody but the accounts preparing the competitions reaches a proposal's discussion: not an admin without the
    /// grant, not a student, not anybody signed out. Each refusal is the one a thread or comment that is not there
    /// gets, so it confirms nothing, and the counts are refused the same way.
    /// </summary>
    [Fact]
    public Task Nobody_without_the_grant_reaches_a_proposals_discussion() => RunTestAsync(async service =>
    {
        // The discussion of the proposal
        var target = Discussion(_proposalId);

        // A reviewer's comment in the discussion
        var comment = await service.CreateCommentAsync(target, _reviewer, "Fits the advanced paper.");

        // Every caller short of a reviewer
        CommentViewer?[] outsiders = [_admin, _student, null];

        // None of them reads it or counts it
        foreach (var outsider in outsiders)
        {
            // Reading, refused like a missing thread
            await Assert.ThrowsAsync<CommentTargetNotFoundException>(() => service.GetCommentsAsync(target, outsider));

            // Counting, refused the same way
            await Assert.ThrowsAsync<CommentTargetNotFoundException>(() => service.GetCommentCountsAsync(
                CommentTargetType.Proposal, [_proposalId.ToString()], outsider));
        }

        // Every signed-in one of them
        CommentViewer[] signedIn = [_admin, _student];

        // None of them writes, replies, edits, deletes or likes there
        foreach (var outsider in signedIn)
        {
            // A new comment, refused like a missing thread
            await Assert.ThrowsAsync<CommentTargetNotFoundException>(
                () => service.CreateCommentAsync(target, outsider, "Why?"));

            // A reply, refused the same way
            await Assert.ThrowsAsync<CommentTargetNotFoundException>(
                () => service.CreateCommentAsync(target, outsider, "Why?", comment.Id));

            // An edit, refused like a missing comment
            await Assert.ThrowsAsync<CommentNotFoundException>(
                () => service.UpdateCommentAsync(comment.Id, outsider, "Too easy."));

            // A delete, refused the same way
            await Assert.ThrowsAsync<CommentNotFoundException>(() => service.DeleteCommentAsync(comment.Id, outsider));

            // A like, refused the same way
            await Assert.ThrowsAsync<CommentNotFoundException>(() => service.ToggleLikeAsync(comment.Id, outsider));
        }

        // The discussion as a reviewer reads it
        var thread = await service.GetCommentsAsync(target, _reviewer);

        // Still the one comment, untouched
        var root = Assert.Single(thread);
        Assert.Equal(comment.Id, root.Id);
        Assert.False(root.IsDeleted);
    });

    /// <summary>
    /// A proposal's count is its discussion's live comments, replies included: neither a deleted comment nor the
    /// version an edit replaced counts. A proposal nobody discusses and an id naming no proposal get no entry.
    /// </summary>
    [Fact]
    public Task A_proposals_count_is_its_live_comments() => RunTestAsync(async service =>
    {
        // The discussion of the proposal
        var target = Discussion(_proposalId);

        // A comment that is later edited
        var edited = await service.CreateCommentAsync(target, _reviewer, "Fits the advanced paper.");

        // A reply to the comment that is later edited
        await service.CreateCommentAsync(target, _otherReviewer, "Agreed.", edited.Id);

        // A comment that is later deleted
        var deleted = await service.CreateCommentAsync(target, _otherReviewer, "Too easy.");

        // The edit
        await service.UpdateCommentAsync(edited.Id, _reviewer, "Fits the advanced paper!");

        // The delete
        await service.DeleteCommentAsync(deleted.Id, _otherReviewer);

        // The counts of both proposals and of an id naming none
        var counts = await service.GetCommentCountsAsync(
            CommentTargetType.Proposal, [_proposalId.ToString(), _otherProposalId.ToString(), "not-an-id"], _reviewer);

        // The edited comment and its reply, under the proposal's id as the client spells it
        Assert.Equal(ImmutableDictionary.CreateRange([KeyValuePair.Create(_proposalId.ToString(), 2)]), counts);
    });

    /// <summary>
    /// A deleted proposal's discussion closes with it: nobody reads, writes, edits or counts it any longer. A delete
    /// keeps the proposal's row under a stamp, so the discussion's own check of the stamp is all that closes it.
    /// </summary>
    [Fact]
    public Task A_deleted_proposals_discussion_closes_with_it() => RunTestAsync(async service =>
    {
        // The discussion of the proposal
        var target = Discussion(_proposalId);

        // A reviewer's comment in the discussion
        var comment = await service.CreateCommentAsync(target, _reviewer, "Fits the advanced paper.");

        // The proposal deleted
        await QueryAsync(context => context.Proposals
            .Where(proposal => proposal.ProblemId == _proposalId)
            .ExecuteUpdateAsync(setters => setters.SetProperty(proposal => proposal.DeletedAt, DateTimeOffset.UtcNow)));

        // Reading, refused like a missing thread
        await Assert.ThrowsAsync<CommentTargetNotFoundException>(() => service.GetCommentsAsync(target, _reviewer));

        // Writing, refused the same way
        await Assert.ThrowsAsync<CommentTargetNotFoundException>(
            () => service.CreateCommentAsync(target, _reviewer, "Still fits."));

        // Replying, refused the same way
        await Assert.ThrowsAsync<CommentTargetNotFoundException>(
            () => service.CreateCommentAsync(target, _otherReviewer, "Agreed.", comment.Id));

        // Editing the comment, refused like a missing comment
        await Assert.ThrowsAsync<CommentNotFoundException>(
            () => service.UpdateCommentAsync(comment.Id, _reviewer, "Still fits."));

        // Deleting the comment, refused the same way
        await Assert.ThrowsAsync<CommentNotFoundException>(() => service.DeleteCommentAsync(comment.Id, _reviewer));

        // The counts, which leave the proposal out
        var counts = await service.GetCommentCountsAsync(
            CommentTargetType.Proposal, [_proposalId.ToString()], _reviewer);

        // No entry
        Assert.Empty(counts);
    });

    /// <summary>
    /// A proposal's problem has no public thread, so the reviewers' discussion is the only thread about it: reading
    /// and writing under the problem's slug are refused like a thread that is not there, to a reader and a reviewer
    /// alike. The slug is guessable, so an open thread would let anybody read and post about a problem no student may
    /// see.
    /// </summary>
    [Fact]
    public Task A_proposals_problem_has_no_public_thread() => RunTestAsync(async service =>
    {
        // The problem's slug, which would name its public thread
        var slug = await QueryValueAsync(context => context.Problems
            .Where(problem => problem.Id == _proposalId)
            .Select(problem => problem.Slug)
            .SingleAsync());

        // The public thread it would name
        var publicThread = new CommentTarget(CommentTargetType.Problem, slug);

        // A reader and a reviewer
        CommentViewer[] viewers = [_student, _reviewer];

        // Neither of them gets in
        foreach (var viewer in viewers)
        {
            // Reading, refused like a missing thread
            await Assert.ThrowsAsync<CommentTargetNotFoundException>(
                () => service.GetCommentsAsync(publicThread, viewer));

            // Writing, refused the same way
            await Assert.ThrowsAsync<CommentTargetNotFoundException>(
                () => service.CreateCommentAsync(publicThread, viewer, "A nice problem."));
        }
    });

    /// <summary>
    /// A comment in a proposal's discussion takes no likes, from a reviewer either.
    /// </summary>
    [Fact]
    public Task A_proposals_discussion_takes_no_likes() => RunTestAsync(async service =>
    {
        // A reviewer's comment in the discussion
        var comment = await service.CreateCommentAsync(Discussion(_proposalId), _reviewer, "Fits the advanced paper.");

        // Another reviewer likes it
        await Assert.ThrowsAsync<CommentNotFoundException>(() => service.ToggleLikeAsync(comment.Id, _otherReviewer));
    });

    /// <inheritdoc/>
    protected override async Task SeedDataAsync(MathCompsDbContext context)
    {
        // The reviewers, the admin and the student
        context.Users.AddRange(
            NewUser(_reviewer.UserId, "Reviewer"),
            NewUser(_otherReviewer.UserId, "OtherReviewer"),
            NewUser(_admin.UserId, "Admin"),
            NewUser(_student.UserId, "Student"));

        // The grant each reviewer prepares the competitions under
        context.UserGrants.AddRange(
            new UserGrant { UserId = _reviewer.UserId, Capability = UserCapability.PrepareCompetitions },
            new UserGrant { UserId = _otherReviewer.UserId, Capability = UserCapability.PrepareCompetitions });

        // The season the pool sits in
        var season = SelectionSeed.NewSeason(context);

        // The pool
        var pool = SelectionSeed.NewProposalsRound(context, season);

        // Its two proposals
        _proposalId = SelectionSeed.NewProposal(context, pool, 1, 1);
        _otherProposalId = SelectionSeed.NewProposal(context, pool, 2, 2);

        // Save seeded data
        await context.SaveChangesAsync();
    }

    /// <summary>
    /// Names a proposal's discussion, the way the client names it.
    /// </summary>
    /// <param name="proposalId">The proposal.</param>
    /// <returns>The discussion's target.</returns>
    private static CommentTarget Discussion(Guid proposalId) =>
        // Keyed by the proposal's id
        new(CommentTargetType.Proposal, proposalId.ToString());
}

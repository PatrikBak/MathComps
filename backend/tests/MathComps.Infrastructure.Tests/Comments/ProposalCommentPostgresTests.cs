using MathComps.Domain.Contracts.Comments;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Comments;
using MathComps.Infrastructure.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;

namespace MathComps.Infrastructure.Tests.Comments;

/// <summary>
/// The <see cref="PreparerCommentPostgresTests"/> for a proposal's discussion, the reviewers' thread about one problem
/// of the problem selection, and beyond them: that it closes once the proposal is deleted, and that the problem has
/// no public thread beside it.
/// </summary>
/// <param name="fixture">The shared PostgreSQL container fixture.</param>
public class ProposalCommentPostgresTests(PostgresContainerFixture fixture) : PreparerCommentPostgresTests(fixture)
{
    /// <inheritdoc/>
    protected override CommentTargetType TargetType => CommentTargetType.Proposal;

    /// <summary>
    /// A deleted proposal's discussion closes with it: nobody reads, writes, edits or counts it any longer. A delete
    /// keeps the proposal's row under a stamp, so the discussion's own check of the stamp is all that closes it.
    /// </summary>
    [Fact]
    public Task A_deleted_proposals_discussion_closes_with_it() => RunTestAsync(async service =>
    {
        // The discussion of the proposal
        var target = Discussion(SubjectId);

        // A reviewer's comment in the discussion
        var comment = await service.CreateCommentAsync(target, Reviewer, "Fits the advanced paper.");

        // The proposal deleted
        await QueryAsync(context => context.Proposals
            .Where(proposal => proposal.ProblemId == SubjectId)
            .ExecuteUpdateAsync(setters => setters.SetProperty(proposal => proposal.DeletedAt, DateTimeOffset.UtcNow)));

        // Reading, refused like a missing thread
        await Assert.ThrowsAsync<CommentTargetNotFoundException>(() => service.GetCommentsAsync(target, Reviewer));

        // Writing, refused the same way
        await Assert.ThrowsAsync<CommentTargetNotFoundException>(
            () => service.CreateCommentAsync(target, Reviewer, "Still fits."));

        // Replying, refused the same way
        await Assert.ThrowsAsync<CommentTargetNotFoundException>(
            () => service.CreateCommentAsync(target, OtherReviewer, "Agreed.", comment.Id));

        // Editing the comment, refused like a missing comment
        await Assert.ThrowsAsync<CommentNotFoundException>(
            () => service.UpdateCommentAsync(comment.Id, Reviewer, "Still fits."));

        // Deleting the comment, refused the same way
        await Assert.ThrowsAsync<CommentNotFoundException>(() => service.DeleteCommentAsync(comment.Id, Reviewer));

        // The counts, which leave the proposal out
        var counts = await service.GetCommentCountsAsync(TargetType, [SubjectId.ToString()], Reviewer);

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
            .Where(problem => problem.Id == SubjectId)
            .Select(problem => problem.Slug)
            .SingleAsync());

        // The public thread it would name
        var publicThread = new CommentTarget(CommentTargetType.Problem, slug);

        // A reader and a reviewer
        CommentViewer[] viewers = [Student, Reviewer];

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

    /// <inheritdoc/>
    protected override void SeedSubjects(MathCompsDbContext context)
    {
        // The season the pool sits in
        var season = SelectionSeed.NewSeason(context);

        // The pool
        var pool = SelectionSeed.NewProposalsRound(context, season);

        // The pool's first two proposals
        SubjectId = SelectionSeed.NewProposal(context, pool, 1, 1);
        OtherSubjectId = SelectionSeed.NewProposal(context, pool, 2, 2);
    }
}

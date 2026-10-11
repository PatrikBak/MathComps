using MathComps.Domain.Contracts.Comments;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Users;
using Microsoft.EntityFrameworkCore;
using System.Collections.Immutable;

namespace MathComps.Infrastructure.Services.Comments.Kinds;

/// <summary>
/// The reviewers' discussion of a proposal.
/// </summary>
/// <param name="ProposalId"><inheritdoc cref="ProposalComment.ProposalId" path="/summary"/></param>
public sealed record ProposalAnchor(Guid ProposalId) : CommentAnchor;

/// <summary>
/// The reviewers' discussions of the proposals, named by the proposal's id. One goes with its proposal once that is
/// deleted.
/// </summary>
/// <param name="grants"><inheritdoc cref="IUserGrantService" path="/summary"/></param>
public class ProposalThreadKind(IUserGrantService grants) : PreparerCommentThreadKind<ProposalAnchor>(grants)
{
    /// <inheritdoc />
    public override CommentTargetType TargetType => CommentTargetType.Proposal;

    /// <inheritdoc />
    public override bool TakesLikes => true;

    /// <inheritdoc />
    public override async Task<CommentThreadSql> SelectAsync(MathCompsDbContext dbContext, CommentTarget target) =>
        // The discussion's links, matched on a proposal that stands
        new(
            "JOIN proposal_comments prc ON c.id = prc.comment_id",
            "prc.proposal_id = @p0",
            [(await ResolveAsync(dbContext, target)).ProposalId]);

    /// <inheritdoc />
    protected override IQueryable<KeyValuePair<string, int>> CountById(
        MathCompsDbContext dbContext, ImmutableList<Guid> ids) =>
        // Each standing proposal's active comments, keyed by its id
        dbContext.ProposalComments
            .Where(link => ids.Contains(link.ProposalId) && link.Proposal.DeletedAt == null)
            .Where(link => link.Comment.Status == CommentStatus.Active)
            .GroupBy(link => link.ProposalId)
            .Select(group => new KeyValuePair<string, int>(group.Key.ToString(), group.Count()));

    /// <inheritdoc />
    protected override async Task<ProposalAnchor> ResolveAsync(MathCompsDbContext dbContext, CommentTarget target)
    {
        // An id that is no GUID names no proposal, refused like a missing thread
        if (!Guid.TryParse(target.TargetId, out var proposalId))
            throw new CommentTargetNotFoundException(target.TargetType, target.TargetId);

        // Whether the proposal stands
        var stands = await dbContext.Proposals
            .AnyAsync(proposal => proposal.ProblemId == proposalId && proposal.DeletedAt == null);

        // The proposal's discussion, or a missing thread when no standing proposal has the id
        return stands
            ? new ProposalAnchor(proposalId)
            : throw new CommentTargetNotFoundException(target.TargetType, target.TargetId);
    }

    /// <inheritdoc />
    protected override async Task<ProposalAnchor?> FindAsync(MathCompsDbContext dbContext, Guid commentId)
    {
        // The standing proposal the comment's link points at
        var proposalId = await dbContext.ProposalComments
            .Where(link => link.CommentId == commentId && link.Proposal.DeletedAt == null)
            .Select(link => (Guid?)link.ProposalId)
            .FirstOrDefaultAsync();

        // Its discussion, or none when the comment hangs off no standing proposal
        return proposalId is { } id ? new ProposalAnchor(id) : null;
    }

    /// <inheritdoc />
    protected override void Attach(MathCompsDbContext dbContext, ProposalAnchor anchor, Guid commentId) =>
        // A link from the comment to the proposal
        dbContext.ProposalComments.Add(new ProposalComment { ProposalId = anchor.ProposalId, CommentId = commentId });
}

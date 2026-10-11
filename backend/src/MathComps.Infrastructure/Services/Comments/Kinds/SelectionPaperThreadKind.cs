using MathComps.Domain.Contracts.Comments;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Users;
using Microsoft.EntityFrameworkCore;
using System.Collections.Immutable;

namespace MathComps.Infrastructure.Services.Comments.Kinds;

/// <summary>
/// The reviewers' discussion of one paper on a board.
/// </summary>
/// <param name="PaperId"><inheritdoc cref="SelectionPaperComment.PaperId" path="/summary"/></param>
public sealed record SelectionPaperAnchor(Guid PaperId) : CommentAnchor;

/// <summary>
/// The reviewers' discussions of the papers on the selection's boards, named by the paper's id, one per paper.
/// </summary>
/// <param name="grants"><inheritdoc cref="IUserGrantService" path="/summary"/></param>
public class SelectionPaperThreadKind(IUserGrantService grants)
    : PreparerCommentThreadKind<SelectionPaperAnchor>(grants)
{
    /// <inheritdoc />
    public override CommentTargetType TargetType => CommentTargetType.SelectionPaper;

    /// <inheritdoc />
    public override bool TakesLikes => true;

    /// <inheritdoc />
    public override async Task<CommentThreadSql> SelectAsync(MathCompsDbContext dbContext, CommentTarget target) =>
        // The discussion's links, matched on a paper that exists
        new(
            "JOIN selection_paper_comments spc ON c.id = spc.comment_id",
            "spc.paper_id = @p0",
            [(await ResolveAsync(dbContext, target)).PaperId]);

    /// <inheritdoc />
    protected override IQueryable<KeyValuePair<string, int>> CountById(
        MathCompsDbContext dbContext, ImmutableList<Guid> ids) =>
        // Each paper's active comments, keyed by its id
        dbContext.SelectionPaperComments
            .Where(link => ids.Contains(link.PaperId))
            .Where(link => link.Comment.Status == CommentStatus.Active)
            .GroupBy(link => link.PaperId)
            .Select(group => new KeyValuePair<string, int>(group.Key.ToString(), group.Count()));

    /// <inheritdoc />
    protected override async Task<SelectionPaperAnchor> ResolveAsync(
        MathCompsDbContext dbContext, CommentTarget target)
    {
        // An id that is no GUID names no paper, refused like a missing thread
        if (!Guid.TryParse(target.TargetId, out var paperId))
            throw new CommentTargetNotFoundException(target.TargetType, target.TargetId);

        // Whether the paper exists
        var exists = await dbContext.SelectionPapers.AnyAsync(paper => paper.Id == paperId);

        // The paper's discussion, or a missing thread when no paper has the id
        return exists
            ? new SelectionPaperAnchor(paperId)
            : throw new CommentTargetNotFoundException(target.TargetType, target.TargetId);
    }

    /// <inheritdoc />
    protected override async Task<SelectionPaperAnchor?> FindAsync(MathCompsDbContext dbContext, Guid commentId)
    {
        // The paper the comment's link points at
        var paperId = await dbContext.SelectionPaperComments
            .Where(link => link.CommentId == commentId)
            .Select(link => (Guid?)link.PaperId)
            .FirstOrDefaultAsync();

        // Its discussion, or none when the comment hangs off no paper
        return paperId is { } id ? new SelectionPaperAnchor(id) : null;
    }

    /// <inheritdoc />
    protected override void Attach(MathCompsDbContext dbContext, SelectionPaperAnchor anchor, Guid commentId) =>
        // A link from the comment to the paper
        dbContext.SelectionPaperComments.Add(
            new SelectionPaperComment { PaperId = anchor.PaperId, CommentId = commentId });
}

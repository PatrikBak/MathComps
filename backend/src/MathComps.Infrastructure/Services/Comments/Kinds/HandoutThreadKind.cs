using MathComps.Domain.Contracts.Comments;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using System.Collections.Immutable;

namespace MathComps.Infrastructure.Services.Comments.Kinds;

/// <summary>
/// A handout's thread.
/// </summary>
/// <param name="HandoutId"><inheritdoc cref="HandoutComment.HandoutId" path="/summary"/></param>
public sealed record HandoutAnchor(Guid HandoutId) : CommentAnchor;

/// <summary>
/// The threads under the handouts, open to anybody and named by the handout's content id. A handout lives in files,
/// so the row its comments hang off is minted the first time anything is attached to it.
/// </summary>
public class HandoutThreadKind : PublicCommentThreadKind<HandoutAnchor>
{
    /// <inheritdoc />
    public override CommentTargetType TargetType => CommentTargetType.Handout;

    /// <inheritdoc />
    public override bool TakesLikes => true;

    /// <inheritdoc />
    public override Task<CommentThreadSql> SelectAsync(MathCompsDbContext dbContext, CommentTarget target) =>
        // The links of the handout with the content id
        Task.FromResult(new CommentThreadSql(
            "JOIN handout_comments hc ON c.id = hc.comment_id JOIN handouts h ON hc.handout_id = h.id",
            "h.content_id = @p0",
            [target.TargetId]));

    /// <inheritdoc />
    public override Task<IQueryable<KeyValuePair<string, int>>> CountAsync(
        MathCompsDbContext dbContext, ImmutableList<string> targetIds, CommentViewer? viewer) =>
        // Each handout's active comments, by its content id
        Task.FromResult(dbContext.HandoutComments
            .Where(handoutComment => targetIds.Contains(handoutComment.Handout.ContentId))
            .Where(handoutComment => handoutComment.Comment.Status == CommentStatus.Active)
            .GroupBy(handoutComment => handoutComment.Handout.ContentId)
            .Select(group => new KeyValuePair<string, int>(group.Key, group.Count())));

    /// <inheritdoc />
    protected override async Task<HandoutAnchor> ResolveAsync(MathCompsDbContext dbContext, CommentTarget target) =>
        // The row standing in for the handout, minted now if nothing has hung off it yet
        new(await ContentAnchors.EnsureHandoutAsync(dbContext, target.TargetId));

    /// <inheritdoc />
    protected override async Task<HandoutAnchor?> FindAsync(MathCompsDbContext dbContext, Guid commentId)
    {
        // The handout the comment's link points at
        var handoutId = await dbContext.HandoutComments
            .Where(link => link.CommentId == commentId)
            .Select(link => (Guid?)link.HandoutId)
            .FirstOrDefaultAsync();

        // Its thread, or none when the comment hangs off no handout
        return handoutId is { } id ? new HandoutAnchor(id) : null;
    }

    /// <inheritdoc />
    protected override void Attach(MathCompsDbContext dbContext, HandoutAnchor anchor, Guid commentId) =>
        // A link from the comment to the handout
        dbContext.HandoutComments.Add(new HandoutComment { HandoutId = anchor.HandoutId, CommentId = commentId });
}

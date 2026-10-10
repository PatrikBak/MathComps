using MathComps.Domain.Contracts.Comments;
using MathComps.Infrastructure.Persistence;

namespace MathComps.Infrastructure.Services.Comments;

/// <summary>
/// A <see cref="CommentThreadKind{TAnchor}"/> whose threads sit under public content and are open to anybody, signed
/// in or not.
/// </summary>
/// <typeparam name="TAnchor">The anchor naming one of this kind's threads.</typeparam>
public abstract class PublicCommentThreadKind<TAnchor> : CommentThreadKind<TAnchor> where TAnchor : CommentAnchor
{
    /// <inheritdoc />
    public override Task<bool> IsOpenAsync(
        MathCompsDbContext dbContext, CommentTarget target, CommentViewer? viewer) =>
        // Open to anybody
        Task.FromResult(true);

    /// <inheritdoc />
    protected override Task<bool> IsOpenToAsync(MathCompsDbContext dbContext, TAnchor anchor, CommentViewer? viewer) =>
        // Open to anybody
        Task.FromResult(true);
}

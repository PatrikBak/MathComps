using MathComps.Domain.Contracts.Comments;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using System.Collections.Immutable;

namespace MathComps.Infrastructure.Services.Comments.Kinds;

/// <summary>
/// A problem's thread.
/// </summary>
/// <param name="ProblemId"><inheritdoc cref="ProblemComment.ProblemId" path="/summary"/></param>
public sealed record ProblemAnchor(Guid ProblemId) : CommentAnchor;

/// <summary>
/// The threads under the problems the archive serves, open to anybody and named by the problem's slug. Only a
/// problem the archive serves, by <see cref="ProblemQueryableExtensions.WhereArchiveServes"/>, has a thread, and any
/// other is refused like a missing one.
/// </summary>
public class ProblemThreadKind : PublicCommentThreadKind<ProblemAnchor>
{
    /// <inheritdoc />
    public override CommentTargetType TargetType => CommentTargetType.Problem;

    /// <inheritdoc />
    public override bool TakesLikes => true;

    /// <inheritdoc />
    public override async Task<CommentThreadSql> SelectAsync(MathCompsDbContext dbContext, CommentTarget target) =>
        // The links of the problem the slug resolves to
        new(
            "JOIN problem_comments pc ON c.id = pc.comment_id",
            "pc.problem_id = @p0",
            [(await ResolveAsync(dbContext, target)).ProblemId]);

    /// <inheritdoc />
    public override Task<IQueryable<KeyValuePair<string, int>>> CountAsync(
        MathCompsDbContext dbContext, ImmutableList<string> targetIds, CommentViewer? viewer) =>
        // A problem's thread, with no bulk count
        throw new ArgumentException("Unsupported target type for bulk counts");

    /// <inheritdoc />
    protected override async Task<ProblemAnchor> ResolveAsync(MathCompsDbContext dbContext, CommentTarget target) =>
        // The served problem with the slug, refused like a missing thread when there is none
        new(await dbContext.Problems
                .WhereArchiveServes(DateTimeOffset.UtcNow)
                .Where(problem => problem.Slug == target.TargetId)
                .Select(problem => (Guid?)problem.Id)
                .FirstOrDefaultAsync()
            ?? throw new CommentTargetNotFoundException(target.TargetType, target.TargetId));

    /// <inheritdoc />
    protected override async Task<ProblemAnchor?> FindAsync(MathCompsDbContext dbContext, Guid commentId)
    {
        // The problems the archive serves, the only ones with a thread
        var servedProblems = dbContext.Problems.WhereArchiveServes(DateTimeOffset.UtcNow);

        // The served problem the comment's link points at
        var problemId = await dbContext.ProblemComments
            .Where(link => link.CommentId == commentId && servedProblems.Any(problem => problem.Id == link.ProblemId))
            .Select(link => (Guid?)link.ProblemId)
            .FirstOrDefaultAsync();

        // Its thread, or none when the comment hangs off no served problem
        return problemId is { } id ? new ProblemAnchor(id) : null;
    }

    /// <inheritdoc />
    protected override void Attach(MathCompsDbContext dbContext, ProblemAnchor anchor, Guid commentId) =>
        // A link from the comment to the problem
        dbContext.ProblemComments.Add(new ProblemComment { ProblemId = anchor.ProblemId, CommentId = commentId });
}

using MathComps.Domain.Contracts.Comments;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using System.Collections.Immutable;

namespace MathComps.Infrastructure.Services.Comments.Kinds;

/// <summary>
/// A news article's thread.
/// </summary>
/// <param name="NewsArticleId"><inheritdoc cref="NewsArticleComment.NewsArticleId" path="/summary"/></param>
public sealed record NewsAnchor(Guid NewsArticleId) : CommentAnchor;

/// <summary>
/// The threads under the news articles, open to anybody and named by the article's content id. An article lives in
/// files, so the row its comments hang off is minted the first time anything is attached to it.
/// </summary>
public class NewsThreadKind : PublicCommentThreadKind<NewsAnchor>
{
    /// <inheritdoc />
    public override CommentTargetType TargetType => CommentTargetType.News;

    /// <inheritdoc />
    public override bool TakesLikes => true;

    /// <inheritdoc />
    public override Task<CommentThreadSql> SelectAsync(MathCompsDbContext dbContext, CommentTarget target) =>
        // The links of the article with the content id
        Task.FromResult(new CommentThreadSql(
            "JOIN news_article_comments nc ON c.id = nc.comment_id "
            + "JOIN news_articles n ON nc.news_article_id = n.id",
            "n.content_id = @p0",
            [target.TargetId]));

    /// <inheritdoc />
    public override Task<IQueryable<KeyValuePair<string, int>>> CountAsync(
        MathCompsDbContext dbContext, ImmutableList<string> targetIds, CommentViewer? viewer) =>
        // Each article's active comments, by its content id
        Task.FromResult(dbContext.NewsArticleComments
            .Where(newsArticleComment => targetIds.Contains(newsArticleComment.NewsArticle.ContentId))
            .Where(newsArticleComment => newsArticleComment.Comment.Status == CommentStatus.Active)
            .GroupBy(newsArticleComment => newsArticleComment.NewsArticle.ContentId)
            .Select(group => new KeyValuePair<string, int>(group.Key, group.Count())));

    /// <inheritdoc />
    protected override async Task<NewsAnchor> ResolveAsync(MathCompsDbContext dbContext, CommentTarget target) =>
        // The row standing in for the article, minted now if nothing has hung off it yet
        new(await ContentAnchors.EnsureNewsArticleAsync(dbContext, target.TargetId));

    /// <inheritdoc />
    protected override async Task<NewsAnchor?> FindAsync(MathCompsDbContext dbContext, Guid commentId)
    {
        // The article the comment's link points at
        var newsArticleId = await dbContext.NewsArticleComments
            .Where(link => link.CommentId == commentId)
            .Select(link => (Guid?)link.NewsArticleId)
            .FirstOrDefaultAsync();

        // Its thread, or none when the comment hangs off no article
        return newsArticleId is { } id ? new NewsAnchor(id) : null;
    }

    /// <inheritdoc />
    protected override void Attach(MathCompsDbContext dbContext, NewsAnchor anchor, Guid commentId) =>
        // A link from the comment to the article
        dbContext.NewsArticleComments.Add(
            new NewsArticleComment { NewsArticleId = anchor.NewsArticleId, CommentId = commentId });
}

namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// Join table linking comments to news articles.
/// </summary>
public class NewsArticleComment
{
    /// <summary>
    /// FK to the news article.
    /// </summary>
    public required Guid NewsArticleId { get; set; }

    /// <summary>
    /// Navigation to news article.
    /// </summary>
    public NewsArticle NewsArticle { get; set; } = null!;

    /// <summary>
    /// FK to the comment.
    /// </summary>
    public required Guid CommentId { get; set; }

    /// <summary>
    /// Navigation to comment.
    /// </summary>
    public Comment Comment { get; set; } = null!;
}

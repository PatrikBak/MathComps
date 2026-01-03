using System.ComponentModel.DataAnnotations;

namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// Anchor entity for news articles. Created on-demand when first referenced.
/// </summary>
public class NewsArticle
{
    /// <summary>
    /// Primary key (Guid v7).
    /// </summary>
    public Guid Id { get; set; } = Guid.CreateVersion7();

    /// <summary>
    /// Identifier matching the file-based article.
    /// </summary>
    [MaxLength(30)]
    public required string ContentId { get; set; }

    /// <summary>
    /// Comments on this article.
    /// </summary>
    public ICollection<NewsArticleComment> Comments { get; } = [];
}

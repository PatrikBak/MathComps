using System.ComponentModel.DataAnnotations.Schema;
using MathComps.Shared;

namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// Represents a text (statement or solution) for a problem in a specific language.
/// Supports multiple languages and tracks whether the text is original or AI-translated.
/// </summary>
public class ProblemText
{
    /// <summary>
    /// Primary key.
    /// </summary>
    public Guid Id { get; set; } = Guid.CreateVersion7();

    /// <summary>
    /// Foreign key to the problem this text belongs to.
    /// </summary>
    public required Guid ProblemId { get; set; }

    /// <summary>
    /// Navigation to the problem.
    /// </summary>
    public Problem Problem { get; set; } = null!;

    /// <summary>
    /// The type of document (statement or solution).
    /// </summary>
    public required DocumentType DocumentType { get; set; }

    /// <summary>
    /// The raw text content (TeX/markup) from the original source. Potentially large, stored as TEXT.
    /// </summary>
    [Column(TypeName = "text")]
    public string? RawText { get; set; }

    /// <summary>
    /// Parsed text as a JSON string (optional).
    /// </summary>
    [Column(TypeName = "jsonb")]
    public string? ParsedText { get; set; }

    /// <summary>
    /// The text content rendered to Markdown+TeX. Null on rows not yet migrated from the JSON AST.
    /// </summary>
    [Column(TypeName = "text")]
    public string? MarkdownText { get; set; }

    /// <summary>
    /// The language of this text.
    /// </summary>
    public required Language Language { get; set; }

    /// <summary>
    /// When this text was last modified.
    /// </summary>
    public required DateTime DateModified { get; set; }

    /// <summary>
    /// Whether this text was automatically translated by AI (true) or is an original text (false).
    /// </summary>
    public required bool IsOriginal { get; set; }

    /// <summary>
    /// Collection of embeddings generated from this text.
    /// </summary>
    public ICollection<ProblemEmbedding> Embeddings { get; } = [];
}

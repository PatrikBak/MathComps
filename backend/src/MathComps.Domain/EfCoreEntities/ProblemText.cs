using System.ComponentModel.DataAnnotations.Schema;
using System.Linq.Expressions;
using MathComps.Domain.Localization;

namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// Represents a text (statement, solution, hints or grading note) for a problem in a specific language.
/// Supports multiple languages and tracks whether the text is original or AI-translated.
/// </summary>
public class ProblemText
{
    /// <summary>
    /// Ranks a problem's texts for one reader: a text in their language first, then the original, then any other
    /// translation. The first text of a document type in this order is the one the reader is served.
    /// </summary>
    /// <param name="readerLanguage">The language the reader asked for.</param>
    /// <returns>The rank, lowest first.</returns>
    public static Expression<Func<ProblemText, int>> ReadersLanguageThenOriginal(Language readerLanguage) =>
        // The reader's language, then the one the problem was written in, then any other
        text => text.Language == readerLanguage ? 0 : text.IsOriginal ? 1 : 2;

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
    /// The type of document (statement, solution, hints or grading note).
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
    /// Whether this text is in the language the problem was first written in (true) or is a translation (false).
    /// </summary>
    public required bool IsOriginal { get; set; }

    /// <summary>
    /// Collection of embeddings generated from this text.
    /// </summary>
    public ICollection<ProblemEmbedding> Embeddings { get; } = [];
}

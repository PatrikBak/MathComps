using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq.Expressions;
using Pgvector;

namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// Represents a single competition problem with metadata and relationships.
/// </summary>
public class Problem
{
    /// <summary>
    /// Expression that selects only the problem tags with good enough fit (goodness of fit >= threshold).
    /// This provides a clean way to filter out tags with poor goodness of fit in LINQ queries.
    /// </summary>
    public static readonly Expression<Func<Problem, IEnumerable<ProblemTag>>> GoodTags =
        // Select only the good enough tags
        problem => problem.ProblemTagsAll.AsQueryable().Where(ProblemTag.IsGoodEnoughTag);

    /// <summary>
    /// Primary key.
    /// </summary>
    public Guid Id { get; set; } = Guid.CreateVersion7();

    /// <summary>
    /// Foreign key to the round instance (round + season combination).
    /// </summary>
    public required Guid RoundInstanceId { get; set; }

    /// <summary>
    /// Navigation to the round instance (round + season combination).
    /// </summary>
    public RoundInstance RoundInstance { get; set; } = null!;

    /// <summary>
    /// Position of the problem within its round  (1-indexed).
    /// </summary>
    [Range(1, int.MaxValue)]
    public required int Number { get; set; }

    /// <summary>
    /// URL-safe unique slug (lowercase, hyphenated).
    /// </summary>
    [MaxLength(100)]
    public required string Slug { get; set; }

    /// <summary>
    /// Problem statement (plaintext/TeX/markup). Potentially large, stored as TEXT.
    /// </summary>
    [Column(TypeName = "text")]
    public required string Statement { get; set; }

    /// <summary>
    /// Parsed problem statement as a JSON string.
    /// </summary>
    [Column(TypeName = "jsonb")]
    public required string StatementParsed { get; set; }

    /// <summary>
    /// Solution text (optional). Potentially large, stored as TEXT.
    /// </summary>
    [Column(TypeName = "text")]
    public string? Solution { get; set; }

    /// <summary>
    /// Parsed solution as a JSON string (optional).
    /// </summary>
    [Column(TypeName = "jsonb")]
    public string? SolutionParsed { get; set; }

    /// <summary>
    /// Optional external link identifier to the solution (short code/URL key).
    /// </summary>
    [MaxLength(200)]
    public string? SolutionLink { get; set; }

    /// <summary>
    /// Authors via the ordered join entity.
    /// </summary>
    public ICollection<ProblemAuthor> ProblemAuthors { get; } = [];

    /// <summary>
    /// The collection of images associated with this problem.
    /// </summary>
    public ICollection<ProblemImage> Images { get; } = [];

    /// <summary>
    /// Associated tags via the ordered join entity. This includes all tags processed
    /// by the LLM, even the rejected ones (i.e. ones with goodness of fit < 0.5).
    /// </summary>
    public ICollection<ProblemTag> ProblemTagsAll { get; } = [];

    /// <summary>
    /// Similarity edges to other problems where this problem is the source.
    /// </summary>
    public ICollection<ProblemSimilarity> SimilarProblems { get; } = [];

    /// <summary>
    /// Similarity edges where this problem appears as the similar target.
    /// </summary>
    public ICollection<ProblemSimilarity> AppearsInProblems { get; } = [];

    /// <summary>
    /// Vector embedding of the problem statement for semantic similarity calculations.
    /// Generated using multilingual E5 model, stored as 768-dimensional vector.
    /// </summary>
    [Column(TypeName = "vector(768)")]
    public Vector? StatementEmbedding { get; set; }

    /// <summary>
    /// Vector embedding of the problem solution for semantic similarity calculations.
    /// Optional - only available when problem has a solution text.
    /// Generated using multilingual E5 model, stored as 768-dimensional vector.
    /// </summary>
    [Column(TypeName = "vector(768)")]
    public Vector? SolutionEmbedding { get; set; }
}

using System.ComponentModel.DataAnnotations;
using System.Linq.Expressions;

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
    /// Optional external link identifier to the solution (short code/URL key).
    /// </summary>
    [MaxLength(200)]
    public string? SolutionLink { get; set; }

    /// <summary>
    /// Collection of texts (statements and solutions) in various languages.
    /// </summary>
    public ICollection<ProblemText> Texts { get; } = [];

    /// <summary>
    /// Authors via the ordered join entity.
    /// </summary>
    public ICollection<ProblemAuthor> ProblemAuthors { get; } = [];

    /// <summary>
    /// Associated tags via the ordered join entity. This includes all tags processed
    /// by the LLM, even the rejected ones (i.e. ones with goodness of fit &lt; 0.5).
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
    /// Likes on this problem by users.
    /// </summary>
    public ICollection<ProblemLike> Likes { get; } = [];

    /// <summary>
    /// Mark statuses on this problem by users.
    /// </summary>
    public ICollection<ProblemMarkStatus> MarkStatuses { get; } = [];

    /// <summary>
    /// Comments on this problem via the join entity.
    /// </summary>
    public ICollection<ProblemComment> ProblemComments { get; } = [];

    /// <summary>
    /// List memberships for this problem across all user lists.
    /// </summary>
    public ICollection<UserProblemListItem> UserProblemListItems { get; } = [];
}

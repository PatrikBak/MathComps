using Pgvector;
using System.Collections.Immutable;

namespace MathComps.Cli.Similarity.Dtos;

/// <summary>
/// Data transfer object containing problem information needed for similarity calculations.
/// Contains only the essential data required for multi-signal similarity computation.
/// </summary>
/// <param name="ProblemId">Unique identifier of the problem.</param>
/// <param name="TagsIds">Collection of tag ids associated with the problem for tag-based similarity.</param>
/// <param name="CompetitionClusteringKey">The clustering key for the problem's contest, which is the path
/// addressing it (e.g., "csmo-a-iii", "imo").</param>
/// <param name="StatementEmbedding">Vector representation of the problem statement for semantic similarity calculations.</param>
/// <param name="SolutionEmbedding">Vector representation of the problem solution for semantic similarity calculations when available.</param>
public record ProblemSimilarityData(
    Guid ProblemId,
    ImmutableHashSet<Guid> TagsIds,
    string CompetitionClusteringKey,
    Vector StatementEmbedding,
    Vector? SolutionEmbedding);

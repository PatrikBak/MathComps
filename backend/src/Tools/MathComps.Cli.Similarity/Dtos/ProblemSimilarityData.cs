using Pgvector;
using System.Collections.Immutable;

namespace MathComps.Cli.Similarity.Dtos;

/// <summary>
/// Data transfer object containing problem information needed for similarity calculations.
/// Contains only the essential data required for multi-signal similarity computation.
/// </summary>
/// <param name="ProblemId">Unique identifier of the problem.</param>
/// <param name="TagsIds">Collection of tag ids associated with the problem for tag-based similarity.</param>
/// <param name="CompetitionId">Competition identifier for competition-based similarity.</param>
/// <param name="CompetitionClusteringKey">The clustering key for the problem's competition, typically derived from the round's composite slug (e.g., "imo-2022-day1").</param>
/// <param name="StatementEmbedding">Vector representation of the problem statement for semantic similarity calculations.</param>
/// <param name="SolutionEmbedding">Vector representation of the problem solution for semantic similarity calculations when available.</param>
public record ProblemSimilarityData(
    Guid ProblemId,
    ImmutableHashSet<Guid> TagsIds,
    Guid CompetitionId,
    string CompetitionClusteringKey,
    Vector StatementEmbedding,
    Vector? SolutionEmbedding);

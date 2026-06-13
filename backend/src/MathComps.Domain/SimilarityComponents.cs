namespace MathComps.Domain;

/// <summary>
/// Individual component scores that contribute to the final similarity calculation. All components are normalized to [0,1] where
/// the higher number means more similar.
/// </summary>
/// <param name="StatementSimilarity">Semantic similarity based on vector embeddings of problem statement text.</param>
/// <param name="SolutionSimilarity">Semantic similarity based on vector embeddings of solution approaches. Null when solution text is unavailable.</param>
/// <param name="TagSimilarity">Categorical similarity computed using Jaccard coefficient on problem classification tags.</param>
/// <param name="CompetitionSimilarity">Contextual similarity based on competition membership.</param>
public record SimilarityComponents(
    double StatementSimilarity,
    double? SolutionSimilarity,
    double TagSimilarity,
    double CompetitionSimilarity);

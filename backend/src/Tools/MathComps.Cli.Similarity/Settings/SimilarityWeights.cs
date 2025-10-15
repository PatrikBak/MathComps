using System.ComponentModel.DataAnnotations;

namespace MathComps.Cli.Similarity.Settings;

/// <summary>
/// Weights for combining different similarity signals in the final scoring calculation.
/// These weights determine the relative importance of each similarity component.
/// Defaults are configured in appsettings.json under CalculateSimilarities:SimilarityWeights.
/// </summary>
public class SimilarityWeights
{
    /// <summary>
    /// Weight for statement text semantic similarity.
    /// </summary>
    [Range(0.0, 1.0)]
    public double StatementSimilarity { get; set; }

    /// <summary>
    /// Weight for solution text semantic similarity.
    /// Only applied when both problems have solution embeddings.
    /// </summary>
    [Range(0.0, 1.0)]
    public double SolutionSimilarity { get; set; }

    /// <summary>
    /// Weight for tag-based similarity (Jaccard similarity).
    /// </summary>
    [Range(0.0, 1.0)]
    public double TagSimilarity { get; set; }

    /// <summary>
    /// Weight for competition-based similarity.
    /// </summary>
    [Range(0.0, 1.0)]
    public double CompetitionSimilarity { get; set; }
}

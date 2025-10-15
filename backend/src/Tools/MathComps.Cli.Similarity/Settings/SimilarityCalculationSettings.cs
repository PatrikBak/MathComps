using System.ComponentModel.DataAnnotations;

namespace MathComps.Cli.Similarity.Settings;

/// <summary>
/// Configuration settings for the similarity calculation process.
/// </summary>
public class SimilarityCalculationSettings
{
    /// <summary>
    /// Configuration section name used in appsettings.json for these settings.
    /// </summary>
    public const string SectionName = "CalculateSimilarities";

    /// <summary>
    /// Total computational budget for candidate retrieval across all similarity strategies.
    /// Higher limits provide more comprehensive results but increase processing time.
    /// </summary>
    [Range(50, 2000)]
    public int TotalCandidateLimit { get; set; }

    /// <summary>
    /// Maps competition composite slugs to a numeric cluster ID for grouping similar competitions.
    /// </summary>
    [Required]
    public required Dictionary<string, double> CompetitionClusterMap { get; set; }

    /// <summary>
    /// Tolerance for matching competition clusters. Competitions with cluster IDs within this tolerance
    /// of a source problem's competition cluster ID are considered relevant.
    /// </summary>
    [Range(0, 100)]
    public double CompetitionTolerance { get; set; }

    /// <summary>
    /// The minimum similarity score required for a problem to be considered a candidate.
    /// This applies to both statement and solution similarity.
    /// </summary>
    [Range(0.0, 1.0)]
    public double MinimalSimilarity { get; set; }

    /// <summary>
    /// Weights for combining different similarity signals into final scores.
    /// These weights also determine the proportional allocation of candidate retrieval resources.
    /// Weights are automatically normalized and should reflect relative strategy importance.
    /// </summary>
    [Required]
    public required SimilarityWeights SimilarityWeights { get; set; }
}

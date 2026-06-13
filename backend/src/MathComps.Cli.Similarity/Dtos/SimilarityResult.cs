using MathComps.Domain;

namespace MathComps.Cli.Similarity.Dtos;

/// <summary>
/// Represents the data for a calculated similarity relationship between two mathematical problems.
/// Provides both the final weighted similarity score and the detailed breakdown of component scores
/// for complete transparency into the multi-signal similarity algorithm.
/// </summary>
/// <param name="TargetProblemId">Unique identifier of the problem that was determined to be similar to the source problem.</param>
/// <param name="TargetProblemSlug">A human-redable identifier of the problem.</param>
/// <param name="SimilarityScore">Final weighted similarity score between 0.0 and 1.0 where higher values indicate stronger similarity.</param>
/// <param name="Components">Detailed breakdown of individual similarity components that contributed to the final score.</param>
public record SimilarityResult(Guid TargetProblemId, string TargetProblemSlug, double SimilarityScore, SimilarityComponents Components);

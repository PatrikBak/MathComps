namespace MathComps.Infrastructure.Options;

/// <summary>
/// Options for similarity queries.
/// </summary>
public class SimilarityOptions
{
    /// <summary>
    /// The name of the configuration section for similarity options.
    /// </summary>
    public const string ConfigurationSectionName = "Similarity";

    /// <summary>
    /// Maximum number of similar problems to return per problem.
    /// </summary>
    public int MaxSimilarProblems { get; init; } = 10;

    /// <summary>
    /// The minimum similarity score required for a problem to be considered similar.
    /// This value should be between 0 and 1.
    /// </summary>
    public double MinSimilarityScore { get; init; } = 0.8;
}

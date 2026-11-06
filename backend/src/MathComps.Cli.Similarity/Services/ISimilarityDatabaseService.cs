using MathComps.Cli.Similarity.Dtos;

namespace MathComps.Cli.Similarity.Services;

/// <summary>
/// Database service for similarity operations on math problems.
/// Stores similarity relationships and checks whether a problem already has them.
/// </summary>
public interface ISimilarityDatabaseService
{
    /// <summary>
    /// Stores calculated similarity relationships between problems.
    /// Replaces any existing similarity relationships for the source problem.
    /// </summary>
    /// <param name="sourceProblemId">ID of the source problem.</param>
    /// <param name="similarityResults">Calculated similarity relationships to store.</param>
    /// <param name="cancellationToken">Token to cancel the operation.</param>
    Task StoreSimilarityResultsAsync(
        Guid sourceProblemId,
        IReadOnlyList<SimilarityResult> similarityResults,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Checks whether a problem already has similarity relationships calculated and stored.
    /// </summary>
    /// <param name="problemId">Unique identifier of the problem to check.</param>
    /// <param name="cancellationToken">Token to cancel the operation.</param>
    /// <returns>True if the problem has existing similarity relationships, false otherwise.</returns>
    Task<bool> HasExistingSimilaritiesAsync(
        Guid problemId,
        CancellationToken cancellationToken = default);
}


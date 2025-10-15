using MathComps.Cli.Similarity.Dtos;

namespace MathComps.Cli.Similarity.Services;

/// <summary>
/// Database service for similarity operations on math problems.
/// Focuses on storing and retrieving similarity relationships and embeddings.
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
    /// Efficient existence check that avoids loading full similarity data when only determining
    /// if processing should be skipped. Much more performant than loading full relationship collections.
    /// </summary>
    /// <param name="problemId">Unique identifier of the problem to check.</param>
    /// <param name="cancellationToken">Token to cancel the operation.</param>
    /// <returns>True if the problem has existing similarity relationships, false otherwise.</returns>
    Task<bool> HasExistingSimilaritiesAsync(
        Guid problemId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Retrieves existing similarity relationships for a specific problem.
    /// Loads full similarity data including scores and target problem information.
    /// Use HasExistingSimilaritiesAsync for simple existence checks when full data is not needed.
    /// </summary>
    /// <param name="problemId">Unique identifier of the problem to retrieve similarities for.</param>
    /// <param name="cancellationToken">Token to cancel the operation.</param>
    /// <returns>Collection of existing similarity relationships with full data.</returns>
    Task<IReadOnlyList<SimilarityResult>> GetExistingSimilaritiesAsync(
        Guid problemId,
        CancellationToken cancellationToken = default);

}


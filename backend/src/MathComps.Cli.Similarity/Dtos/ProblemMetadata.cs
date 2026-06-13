namespace MathComps.Cli.Similarity.Dtos;

/// <summary>
/// Lightweight data transfer object containing basic problem metadata for batch processing operations.
/// </summary>
/// <param name="Id">Unique identifier of the problem.</param>
/// <param name="Slug">URL-safe identifier for logging and human-readable references.</param>
public record ProblemMetadata(Guid Id, string Slug);

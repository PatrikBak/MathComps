namespace MathComps.Cli.Embeddings.Dtos;

/// <summary>
/// Lightweight representation of a problem required for embedding generation.
/// </summary>
/// <param name="Id">Problem identifier.</param>
/// <param name="Slug">The slug for nice logging.</param>
/// <param name="Statement">Problem statement text.</param>
/// <param name="Solution">Optional solution text.</param>
public record ProblemForEmbeddingDto(Guid Id, string Slug, string Statement, string? Solution);

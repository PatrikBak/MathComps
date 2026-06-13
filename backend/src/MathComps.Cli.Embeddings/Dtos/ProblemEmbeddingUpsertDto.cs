using MathComps.Domain.EfCoreEntities;

namespace MathComps.Cli.Embeddings.Dtos;

/// <summary>
/// Data transfer object describing an embedding to persist for a problem.
/// </summary>
/// <param name="DocumentType"><inheritdoc cref="ProblemText.DocumentType" path="/summary"/></param>
/// <param name="EmbeddingType"><inheritdoc cref="ProblemEmbedding.EmbeddingType" path="/summary"/></param>
/// <param name="ModelName"><inheritdoc cref="ProblemEmbedding.ModelName" path="/summary"/></param>
/// <param name="Values"><inheritdoc cref="ProblemEmbedding.Embedding" path="/summary"/></param>
/// <param name="DateUpdated"><inheritdoc cref="ProblemEmbedding.DateUpdated" path="/summary"/></param>
public record ProblemEmbeddingUpsertDto(
    DocumentType DocumentType,
    string EmbeddingType,
    string ModelName,
    float[] Values,
    DateTime DateUpdated
);

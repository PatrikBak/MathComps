using System.Collections.Immutable;

namespace MathComps.Domain.ApiDtos.ProblemQuery;

/// <summary>
/// Representation of a problem considered similar to the current one.
/// </summary>
/// <param name="Slug">URL-safe unique slug for the similar problem.</param>
/// <param name="Source">Source metadata of the similar problem.</param>
/// <param name="Statement">Statement snippet or full text of the similar problem.</param>
/// <param name="SimilarityScore">Similarity score in the range [0, 1].</param>
/// <param name="Images">Associated images with dimensions and scaling metadata.</param>
public record SimilarProblemDto(
    string Slug,
    ProblemSource Source,
    string Statement,
    double SimilarityScore,
    ImmutableList<ProblemImageDto> Images
);

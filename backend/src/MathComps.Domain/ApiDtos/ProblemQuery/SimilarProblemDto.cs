using System.Collections.Immutable;
using MathComps.Shared;

namespace MathComps.Domain.ApiDtos.ProblemQuery;

/// <summary>
/// Representation of a problem considered similar to the current one.
/// </summary>
/// <param name="Slug">URL-safe unique slug for the similar problem.</param>
/// <param name="Source">Source metadata of the similar problem.</param>
/// <param name="StatementMarkdown">Statement of the similar problem as a Markdown+TeX string.</param>
/// <param name="StatementLanguage">Language of the returned statement
/// (may differ from requested language when fallback to original occurs).</param>
/// <param name="SimilarityScore">Similarity score in the range [0, 1].</param>
/// <param name="Images">Associated images with dimensions and scaling metadata.</param>
public record SimilarProblemDto(
    string Slug,
    ProblemSource Source,
    string StatementMarkdown,
    Language StatementLanguage,
    double SimilarityScore,
    ImmutableList<ProblemImageDto> Images
);

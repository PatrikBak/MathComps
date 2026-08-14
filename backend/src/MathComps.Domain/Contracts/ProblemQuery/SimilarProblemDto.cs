namespace MathComps.Domain.Contracts.ProblemQuery;

/// <summary>
/// Representation of a problem considered similar to the current one.
/// </summary>
/// <param name="Slug">URL-safe unique slug for the similar problem.</param>
/// <param name="Source">Source metadata of the similar problem.</param>
/// <param name="StatementMarkdown">Statement of the similar problem as a Markdown+TeX string, in the requested
/// language where a translation exists and in the original otherwise.</param>
/// <param name="SimilarityScore">Similarity score in the range [0, 1].</param>
public record SimilarProblemDto(
    string Slug,
    ProblemSource Source,
    string StatementMarkdown,
    double SimilarityScore
);

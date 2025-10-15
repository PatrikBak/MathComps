using System.Collections.Immutable;
using MathComps.Domain.ApiDtos.Helpers;

namespace MathComps.Domain.ApiDtos.ProblemQuery;

/// <summary>
/// A single problem presented to the UI.
/// </summary>
/// <param name="Slug">URL-safe unique identifier for the problem.</param>
/// <param name="StatementParsed">Problem statement as structured JSON content blocks.</param>
/// <param name="Source">Competition/season/round/category metadata.</param>
/// <param name="Tags">Associated tags with type categorization.</param>
/// <param name="Authors">Associated authors.</param>
/// <param name="SimilarProblems">Recommended similar problems and their similarity scores.</param>
public record ProblemDto(
    string Slug,
    string? StatementParsed,
    ProblemSource Source,
    ImmutableList<TagDto> Tags,
    ImmutableList<LabeledSlug> Authors,
    ImmutableList<SimilarProblemDto> SimilarProblems,
    ImmutableList<ProblemImageDto> Images,
    string? SolutionLink
);

using System.Collections.Immutable;
using MathComps.Domain.ApiDtos.Helpers;
using MathComps.Domain.Localization;

namespace MathComps.Domain.ApiDtos.ProblemQuery;

/// <summary>
/// A single problem presented to the UI.
/// </summary>
/// <param name="Slug">URL-safe unique identifier for the problem.</param>
/// <param name="StatementMarkdown">Problem statement as a Markdown+TeX string.</param>
/// <param name="StatementLanguage">Language of the returned statement
/// (may differ from requested language when fallback to original occurs).</param>
/// <param name="Source">Competition/season/round/category metadata.</param>
/// <param name="Tags">Associated tags with type categorization.</param>
/// <param name="Authors">Associated authors.</param>
/// <param name="SimilarProblems">Recommended similar problems and their similarity scores.</param>
/// <param name="Images">The collection of images associated with this problem.</param>
/// <param name="SolutionLink">Optional external link identifier to the solution (short code/URL key).</param>
/// <param name="Liked">Whether the current user has liked this problem.</param>
/// <param name="Marked">Whether the current user has marked this problem.</param>
/// <param name="LikeCount">Total number of likes for this problem.</param>
/// <param name="CommentCount">Total number of comments for this problem.</param>
/// <param name="ListContentIds">Content IDs of the user's lists that contain this problem. Empty for anonymous users.</param>
public record ProblemDto(
    string Slug,
    string StatementMarkdown,
    Language StatementLanguage,
    ProblemSource Source,
    ImmutableList<TagDto> Tags,
    ImmutableList<LabeledSlug> Authors,
    ImmutableList<SimilarProblemDto> SimilarProblems,
    ImmutableList<ProblemImageDto> Images,
    string? SolutionLink,
    bool Liked,
    bool Marked,
    int LikeCount,
    int CommentCount,
    ImmutableList<string> ListContentIds
);

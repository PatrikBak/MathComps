using System.Collections.Immutable;

namespace MathComps.Cli.Tagging.Dtos;

/// <summary>
/// Represents the essential details of a problem for the purpose of AI tagging.
/// </summary>
/// <param name="Id">The unique identifier of the problem.</param>
/// <param name="Slug">The unique slug identifier of the problem for file tracking.</param>
/// <param name="Statement">The full text of the problem statement.</param>
/// <param name="Solution">The full text of the problem's solution, if available.</param>
public record ProblemDetailsDto(
    Guid Id,
    string Slug,
    string Statement,
    string? Solution,
    ImmutableDictionary<string, ProblemTagData> TagsData)
{
    /// <summary>
    /// Returns only tag with goodness-of-fit at least 0.5.
    /// </summary>
    public ImmutableDictionary<string, ProblemTagData> ApprovedTags() =>
        TagsData.Where(kv => kv.Value.GoodnessOfFit >= 0.5f).ToImmutableDictionary();
}

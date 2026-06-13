using System.Collections.Immutable;
using MathComps.Domain.ApiDtos.Helpers;

namespace MathComps.Domain.ApiDtos.SearchBar;

/// <summary>
/// A competition option accompanied by its available categories and rounds with problem counts for filtering.
/// </summary>
/// <param name="CompetitionData">Competition label, slug, and aggregated problem count.</param>
/// <param name="CategoryData">Available categories for the competition with their problem counts.</param>
/// <param name="RoundData">Available rounds for the competition with their problem counts (for rounds without categories).</param>
public record CompetitionFilterOption(
    FacetOption CompetitionData,
    ImmutableList<CategoryFilterOption> CategoryData,
    ImmutableList<FacetOption> RoundData
);

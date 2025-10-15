using System.Collections.Immutable;
using MathComps.Domain.ApiDtos.Helpers;

namespace MathComps.Domain.ApiDtos.SearchBar;

/// <summary>
/// A category option accompanied by its available rounds and problem counts for filtering.
/// </summary>
/// <param name="CategoryData">Category label, slug, and aggregated problem count.</param>
/// <param name="RoundData">Available rounds for the category with their problem counts.</param>
public record CategoryFilterOption(
    FacetOption CategoryData,
    ImmutableList<FacetOption> RoundData
);

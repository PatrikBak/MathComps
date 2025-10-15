using System.Collections.Immutable;
using MathComps.Domain.ApiDtos.Helpers;

namespace MathComps.Domain.ApiDtos.SearchBar;

/// <summary>
/// All available options for the search filters, each accompanied by problem counts.
/// </summary>
/// <param name="Competitions">Competitions with their categories and rounds with problem counts.</param>
/// <param name="Seasons">Seasons/years with problem counts.</param>
/// <param name="ProblemNumbers">Available problem numbers with counts.</param>
/// <param name="Tags">Tags with problem counts.</param>
/// <param name="Authors">Authors with problem counts.</param>
public record SearchBarOptions(
    ImmutableList<CompetitionFilterOption> Competitions,
    ImmutableList<FacetOption> Seasons,
    ImmutableList<FacetOption> ProblemNumbers,
    ImmutableList<FacetOption> Tags,
    ImmutableList<FacetOption> Authors
);

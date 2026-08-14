using System.Collections.Immutable;
using MathComps.Domain.Contracts.Helpers;

namespace MathComps.Domain.Contracts.SearchBar;

/// <summary>
/// All available options for the search filters, each accompanied by problem counts.
/// </summary>
/// <param name="Competitions">Competitions with their categories and rounds with problem counts.</param>
/// <param name="Contests">The contests as the tree they form, addressed by path — the competitions, each
/// carrying everything below it and its whole subtree's problem count.</param>
/// <param name="Seasons">Seasons/years with problem counts.</param>
/// <param name="ProblemNumbers">Available problem numbers with counts.</param>
/// <param name="Tags">Tags with problem counts and type categorization.</param>
/// <param name="Authors">Authors with problem counts.</param>
public record SearchBarOptions(
    ImmutableList<CompetitionFilterOption> Competitions,
    ImmutableList<ContestNodeOption> Contests,
    ImmutableList<FacetOption> Seasons,
    ImmutableList<FacetOption> ProblemNumbers,
    ImmutableList<TagFacetOption> Tags,
    ImmutableList<FacetOption> Authors
);

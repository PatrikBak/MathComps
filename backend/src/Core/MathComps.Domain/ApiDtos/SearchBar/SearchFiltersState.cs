using System.Collections.Immutable;
using MathComps.Domain.ApiDtos.Helpers;

namespace MathComps.Domain.ApiDtos.SearchBar;

/// <summary>
/// Complete state of the search filters (user's selections).
/// </summary>
/// <param name="SearchText">Free-text query.</param>
/// <param name="SearchInSolution">When true, search is applied to solution text as well.</param>
/// <param name="Seasons">Selected seasons/years.</param>
/// <param name="Selections">Enhanced hierarchical competition/category/round selections.</param>
/// <param name="ProblemNumbers">Specific problem numbers in the competitions (e.g. the 6th problem).</param>
/// <param name="Tags">Selected tags.</param>
/// <param name="TagLogic">Logical operator to combine multiple tag selections.</param>
/// <param name="Authors">Selected authors.</param>
/// <param name="AuthorLogic">Logical operator to combine multiple author selections.</param>
public record SearchFiltersState(
    string SearchText,
    bool SearchInSolution,
    ImmutableList<LabeledSlug> Seasons,
    ImmutableList<ContestSelection> Selections,
    ImmutableList<int> ProblemNumbers,
    ImmutableList<LabeledSlug> Tags,
    LogicToggle TagLogic,
    ImmutableList<LabeledSlug> Authors,
    LogicToggle AuthorLogic
);

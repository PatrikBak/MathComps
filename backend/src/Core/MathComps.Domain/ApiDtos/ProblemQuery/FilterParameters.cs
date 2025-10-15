using System.Collections.Immutable;
using System.ComponentModel.DataAnnotations;
using MathComps.Domain.ApiDtos.Helpers;
using MathComps.Domain.ApiDtos.SearchBar;

namespace MathComps.Domain.ApiDtos.ProblemQuery;

/// <summary>
/// Core filtering parameters needed for problem filtering (backend-only data).
/// Contains only the essential identifiers and values needed for database queries,
/// without UI-specific display labels or metadata.
/// </summary>
/// <param name="SearchText">Free-text query for problem statement and solution. Length is limited to prevent DoS attacks.</param>
/// <param name="SearchInSolution">Whether to include solution text in search.</param>
/// <param name="OlympiadYears">Selected olympiad edition numbers as integers (e.g., 75 for 75th edition).</param>
/// <param name="Contests">Selected competitions/categories/rounds.</param>
/// <param name="ProblemNumbers">Specific problem numbers to filter by.</param>
/// <param name="TagSlugs">Selected tag slugs for filtering.</param>
/// <param name="TagLogic">Logical operator for combining tag filters.</param>
/// <param name="AuthorSlugs">Selected author slugs for filtering.</param>
/// <param name="AuthorLogic">Logical operator for combining author filters.</param>
public record FilterParameters(
    [StringLength(500, MinimumLength = 1, ErrorMessage = "Search text must be between 1 and 500 characters")]
    string SearchText,
    bool SearchInSolution,
    ImmutableList<int> OlympiadYears,
    ImmutableList<ContestSelection> Contests,
    ImmutableList<int> ProblemNumbers,
    ImmutableList<string> TagSlugs,
    LogicToggle TagLogic,
    ImmutableList<string> AuthorSlugs,
    LogicToggle AuthorLogic
);

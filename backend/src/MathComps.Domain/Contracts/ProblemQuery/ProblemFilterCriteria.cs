using System.Collections.Immutable;
using MathComps.Domain.Contracts.Helpers;

namespace MathComps.Domain.Contracts.ProblemQuery;

/// <inheritdoc cref="FilterParameters" path="/summary"/>
/// <param name="SearchText"><inheritdoc cref="FilterParameters" path="/param[@name='SearchText']"/></param>
/// <param name="SearchInSolution"><inheritdoc cref="FilterParameters" path="/param[@name='SearchInSolution']"/></param>
/// <param name="OlympiadYears"><inheritdoc cref="FilterParameters" path="/param[@name='OlympiadYears']"/></param>
/// <param name="CompetitionPaths"><inheritdoc cref="FilterParameters" path="/param[@name='CompetitionPaths']"/></param>
/// <param name="ProblemNumbers"><inheritdoc cref="FilterParameters" path="/param[@name='ProblemNumbers']"/></param>
/// <param name="TagSlugs"><inheritdoc cref="FilterParameters" path="/param[@name='TagSlugs']"/></param>
/// <param name="TagLogic"><inheritdoc cref="FilterParameters" path="/param[@name='TagLogic']"/></param>
/// <param name="AuthorSlugs"><inheritdoc cref="FilterParameters" path="/param[@name='AuthorSlugs']"/></param>
/// <param name="AuthorLogic"><inheritdoc cref="FilterParameters" path="/param[@name='AuthorLogic']"/></param>
public record ProblemFilterCriteria(
    string SearchText,
    bool SearchInSolution,
    ImmutableList<int> OlympiadYears,
    ImmutableList<string> CompetitionPaths,
    ImmutableList<int> ProblemNumbers,
    ImmutableList<string> TagSlugs,
    LogicToggle TagLogic,
    ImmutableList<string> AuthorSlugs,
    LogicToggle AuthorLogic
);

using System.Collections.Immutable;

namespace MathComps.Domain.Contracts.SearchBar;

/// <summary>
/// One competition a season holds, named by the chain of competitions down to it, with how many problems it carries.
/// </summary>
/// <param name="Path"><inheritdoc cref="EfCoreEntities.Competition.Path" path="/summary"/></param>
/// <param name="Labels">The display name of every competition down to this one, root-first.</param>
/// <param name="ProblemCount">The number of problems in the competition.</param>
public record CompetitionWithCount(
    string Path,
    ImmutableList<string> Labels,
    int ProblemCount
);

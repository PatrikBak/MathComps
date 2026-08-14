using System.Collections.Immutable;

namespace MathComps.Domain.Contracts.SearchBar;

/// <summary>
/// One contest a season holds, named by the chain of contests down to it, with how many problems it carries.
/// </summary>
/// <param name="Path"><inheritdoc cref="EfCoreEntities.Competition.Path" path="/summary"/></param>
/// <param name="Labels">The display name of every contest down to this one, root-first.</param>
/// <param name="ProblemCount">The number of problems in the contest.</param>
public record ContestWithCount(
    string Path,
    ImmutableList<string> Labels,
    int ProblemCount
);

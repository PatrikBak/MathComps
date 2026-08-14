using System.Collections.Immutable;

namespace MathComps.Domain.Contracts.SearchBar;

/// <summary>
/// One competition in the taxonomy, at whatever depth it sits, carrying what its whole subtree holds and the
/// competitions one level below it. Its path is unique across the tree, so a reader names a competition without
/// knowing which level it belongs to.
/// </summary>
/// <param name="Path"><inheritdoc cref="EfCoreEntities.Competition.Path" path="/summary"/></param>
/// <param name="DisplayName">The competition's display name (e.g. <c>Domáce kolo</c>).</param>
/// <param name="FullName">The competition's name in full (e.g. <c>Kategória A</c>).</param>
/// <param name="Count">Number of problems sitting anywhere under this competition, itself included.</param>
/// <param name="Children"><inheritdoc cref="EfCoreEntities.Competition.Children" path="/summary"/></param>
public record CompetitionNodeOption(
    string Path,
    string DisplayName,
    string FullName,
    int Count,
    ImmutableList<CompetitionNodeOption> Children
);

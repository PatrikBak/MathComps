using System.Collections.Immutable;

namespace MathComps.Domain.Contracts.SearchBar;

/// <summary>
/// One contest in the taxonomy, at whatever depth it sits, carrying what its whole subtree holds and the
/// contests one level below it. Its path is unique across the tree, so a reader names a contest without
/// knowing which level it belongs to.
/// </summary>
/// <param name="Path"><inheritdoc cref="EfCoreEntities.Competition.Path" path="/summary"/></param>
/// <param name="DisplayName">The contest's display name (e.g. <c>Domáce kolo</c>).</param>
/// <param name="FullName">The contest's name in full (e.g. <c>Kategória A</c>).</param>
/// <param name="Count">Number of problems sitting anywhere under this contest, itself included.</param>
/// <param name="Children"><inheritdoc cref="EfCoreEntities.Competition.Children" path="/summary"/></param>
public record ContestNodeOption(
    string Path,
    string DisplayName,
    string FullName,
    int Count,
    ImmutableList<ContestNodeOption> Children
);

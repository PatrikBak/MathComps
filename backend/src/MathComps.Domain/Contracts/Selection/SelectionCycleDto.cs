using MathComps.Domain.Contracts.Competitions;
using MathComps.Domain.EfCoreEntities;

namespace MathComps.Domain.Contracts.Selection;

/// <summary>
/// A hosted group a board can be finalized into.
/// </summary>
/// <param name="Id">The group's identifier.</param>
/// <param name="Name">The group's name, in the language the selection is read in.</param>
/// <param name="OpensAt"><inheritdoc cref="HostedGroup.OpensAt" path="/summary"/></param>
/// <param name="Categories">
/// The categories of its rounds, in the order the taxonomy sets them out.
/// </param>
/// <param name="ProblemCount"><inheritdoc cref="HostedGroup.ProblemCount" path="/summary"/></param>
public record SelectionCycleDto(
    Guid Id,
    string Name,
    DateTimeOffset OpensAt,
    IReadOnlyList<HostedCompetitionCategory> Categories,
    int ProblemCount);

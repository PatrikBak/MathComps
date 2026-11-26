using MathComps.Domain.EfCoreEntities;

namespace MathComps.Domain.Contracts.Selection;

/// <summary>
/// The cycle a board picks papers for.
/// </summary>
/// <param name="Name">The cycle's name, in the language the selection is read in.</param>
/// <param name="OpensAt"><inheritdoc cref="HostedGroup.OpensAt" path="/summary"/></param>
/// <param name="Stage"><inheritdoc cref="BoardStage" path="/summary"/></param>
public record BoardCycleDto(string Name, DateTimeOffset OpensAt, BoardStage Stage);

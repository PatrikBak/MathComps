using MathComps.Domain.EfCoreEntities;

namespace MathComps.Infrastructure.Services.Selection;

/// <summary>
/// One slot of one paper on one board.
/// </summary>
/// <param name="BoardId">The board holding the slot.</param>
/// <param name="PaperId">The paper holding the slot.</param>
/// <param name="Index"><inheritdoc cref="SelectionSlot.Position" path="/summary"/></param>
public sealed record SlotAddress(Guid BoardId, Guid PaperId, int Index);

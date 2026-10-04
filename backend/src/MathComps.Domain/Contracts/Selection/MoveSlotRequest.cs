namespace MathComps.Domain.Contracts.Selection;

/// <summary>
/// A request to trade a slot with its neighbour in the same paper.
/// </summary>
/// <param name="Direction">Which neighbour the slot trades with, null when the request omitted it.</param>
public record MoveSlotRequest(SlotDirection? Direction);

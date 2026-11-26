using MathComps.Domain.EfCoreEntities;

namespace MathComps.Domain.Contracts.Selection;

/// <summary>
/// One board of the selection with its papers.
/// </summary>
/// <param name="Id">The board's identifier.</param>
/// <param name="Name"><inheritdoc cref="SelectionBoard.Name" path="/summary"/></param>
/// <param name="Papers">Its papers, in the order the board sets them out.</param>
/// <param name="Cycle">The cycle it picks papers for, or null when it picks for no group.</param>
public record SelectionBoardDto(
    Guid Id,
    string Name,
    IReadOnlyList<SelectionPaperDto> Papers,
    BoardCycleDto? Cycle);

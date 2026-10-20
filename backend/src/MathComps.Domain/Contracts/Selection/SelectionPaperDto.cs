using MathComps.Domain.EfCoreEntities;

namespace MathComps.Domain.Contracts.Selection;

/// <summary>
/// One paper on a board.
/// </summary>
/// <param name="Id">The paper's identifier.</param>
/// <param name="Name"><inheritdoc cref="SelectionPaper.Name" path="/summary"/></param>
/// <param name="Category">
/// The category the paper fills, by its <see cref="OrganizationCategory.Name"/>; null for a paper outside the
/// categories.
/// </param>
/// <param name="Slots">The problem in each slot by its id, in slot order, null where the slot stands empty.</param>
public record SelectionPaperDto(
    Guid Id,
    string Name,
    string? Category,
    IReadOnlyList<Guid?> Slots);

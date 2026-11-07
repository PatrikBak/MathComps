namespace MathComps.Domain.Contracts.Defense;

/// <summary>
/// One drawing cut out of a photo of a handwritten page.
/// </summary>
/// <param name="Id">The kept <see cref="EfCoreEntities.DefensePhotoCrop"/>.</param>
/// <param name="Label"><inheritdoc cref="EfCoreEntities.DefensePhotoCrop.Label" path="/summary"/></param>
public record DefensePhotoCropDto(Guid Id, string Label);

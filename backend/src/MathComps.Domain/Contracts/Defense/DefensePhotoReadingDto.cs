namespace MathComps.Domain.Contracts.Defense;

/// <summary>
/// What a photo of a handwritten page read as.
/// </summary>
/// <param name="PhotoId">The kept <see cref="EfCoreEntities.DefensePhoto"/>.</param>
/// <param name="Link"><inheritdoc cref="DefenseTurnPhotoDto.Link" path="/summary"/></param>
/// <param name="Text">The page written out as Markdown with LaTeX math, mistakes included. Its drawings are in
/// <paramref name="Crops"/>.</param>
/// <param name="Crops">The drawings cut out of the page, in the order the reading lists them.</param>
public record DefensePhotoReadingDto(
    Guid PhotoId, string Link, string Text, IReadOnlyList<DefensePhotoCropDto> Crops);

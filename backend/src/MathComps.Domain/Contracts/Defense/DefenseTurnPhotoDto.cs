namespace MathComps.Domain.Contracts.Defense;

/// <summary>
/// A photo of a handwritten page a message was sent with, as returned to the client.
/// </summary>
/// <param name="Id">The photo's identifier.</param>
/// <param name="Link">A link to the page, which expires.</param>
/// <param name="Crops">The drawings cut out of the page, in the order its reading lists them.</param>
public record DefenseTurnPhotoDto(Guid Id, string Link, IReadOnlyList<DefenseTurnCropDto> Crops);

namespace MathComps.Domain.Contracts.Defense;

/// <summary>
/// A drawing cut out of a photo a message was sent with, as returned to the client.
/// </summary>
/// <param name="Id">The drawing's identifier.</param>
/// <param name="Link">A link to the drawing, which expires.</param>
public record DefenseTurnCropDto(Guid Id, string Link);

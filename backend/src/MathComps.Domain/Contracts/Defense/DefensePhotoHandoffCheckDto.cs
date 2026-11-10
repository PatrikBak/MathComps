namespace MathComps.Domain.Contracts.Defense;

/// <summary>
/// What a phone holding a handoff code is told about it: where its photos go now, and the size a photo is read at.
/// </summary>
/// <param name="Handoff"><inheritdoc cref="DefensePhotoHandoffTargetDto" path="/summary"/></param>
/// <param name="PhotoLongEdge"><inheritdoc cref="DefenseLimitsDto" path="/param[@name='PhotoLongEdge']"/></param>
public record DefensePhotoHandoffCheckDto(DefensePhotoHandoffTargetDto Handoff, int PhotoLongEdge);

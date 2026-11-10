namespace MathComps.Domain.Contracts.Defense;

/// <summary>
/// A photo sent by a handoff code, as read, and the problem it went to.
/// </summary>
/// <param name="Reading"><inheritdoc cref="DefensePhotoReadingDto" path="/summary"/></param>
/// <param name="Target">The problem the photo went to: the one the code pointed at when the photo was sent.</param>
public record DefensePhotoHandoffReadingDto(DefensePhotoReadingDto Reading, NamedDefenseTarget Target);

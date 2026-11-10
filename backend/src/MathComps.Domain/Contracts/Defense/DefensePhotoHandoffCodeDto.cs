namespace MathComps.Domain.Contracts.Defense;

/// <summary>
/// A student's live handoff code.
/// </summary>
/// <param name="Code"><inheritdoc cref="EfCoreEntities.DefensePhotoHandoff.Code" path="/summary"/></param>
/// <param name="ExpiresAt"><inheritdoc cref="EfCoreEntities.DefensePhotoHandoff.ExpiresAt" path="/summary"/></param>
public record DefensePhotoHandoffCodeDto(string Code, DateTimeOffset ExpiresAt);

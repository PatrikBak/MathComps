namespace MathComps.Domain.Contracts.Defense;

/// <summary>
/// Where a live handoff code sends photos now, and until when it works.
/// </summary>
/// <param name="Target">The problem photos sent by the code go to now.</param>
/// <param name="ExpiresAt"><inheritdoc cref="EfCoreEntities.DefensePhotoHandoff.ExpiresAt" path="/summary"/></param>
public record DefensePhotoHandoffTargetDto(NamedDefenseTarget Target, DateTimeOffset ExpiresAt);

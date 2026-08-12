namespace MathComps.Domain.Contracts.Users;

/// <summary>
/// Where the caller stands on acknowledging what talking to the AI tutor entails.
/// </summary>
/// <param name="ConsentedAt">When they acknowledged it, or null while they have yet to.</param>
public record AiConsentDto(DateTimeOffset? ConsentedAt);

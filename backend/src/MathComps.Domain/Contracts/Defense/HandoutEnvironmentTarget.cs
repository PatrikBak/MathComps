namespace MathComps.Domain.Contracts.Defense;

/// <summary>
/// The handout environment a defense is held against: which handout, and which environment within it. The
/// environment's identity is only unique within its own handout, so both parts are needed to locate it.
/// </summary>
/// <param name="HandoutContentId">The handout's permanent content id.</param>
/// <param name="EnvironmentId">The environment's permanent id, unique within its handout.</param>
public record HandoutEnvironmentTarget(string HandoutContentId, string EnvironmentId);

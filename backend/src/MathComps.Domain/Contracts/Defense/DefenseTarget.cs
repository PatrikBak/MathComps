using System.Text.Json.Serialization;

namespace MathComps.Domain.Contracts.Defense;

/// <summary>
/// What a defense conversation is held against. Exactly one arm applies to any one session.
/// </summary>
[JsonPolymorphic(TypeDiscriminatorPropertyName = "kind")]
[JsonDerivedType(typeof(HandoutEnvironmentTarget), typeDiscriminator: "handout")]
[JsonDerivedType(typeof(ProblemTarget), typeDiscriminator: "problem")]
public abstract record DefenseTarget;

/// <summary>
/// The handout environment a defense is held against: which handout, and which environment within it. The
/// environment's identity is only unique within its own handout, so both parts are needed to locate it.
/// </summary>
/// <param name="HandoutContentId">The handout's permanent content id.</param>
/// <param name="EnvironmentId">The environment's permanent id, unique within its handout.</param>
public sealed record HandoutEnvironmentTarget(string HandoutContentId, string EnvironmentId) : DefenseTarget;

/// <summary>
/// The archive problem a defense is held against. One id is enough, a problem belonging to exactly one round.
/// </summary>
/// <param name="ProblemId">The problem's identifier.</param>
public sealed record ProblemTarget(Guid ProblemId) : DefenseTarget;

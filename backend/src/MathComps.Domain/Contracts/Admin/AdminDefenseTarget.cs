using System.Text.Json.Serialization;
using MathComps.Domain.Contracts.Defense;
using MathComps.Domain.Contracts.ProblemQuery;

namespace MathComps.Domain.Contracts.Admin;

/// <summary>
/// What a conversation was held against, as the review surface names it. Exactly one arm applies to any one
/// conversation.
/// </summary>
/// <remarks>
/// The handout arm carries ids and the problem arm carries names, because the two are named from different
/// places: handout content is read on the reader's own side, while the taxonomy is not, and a competition
/// still under embargo is absent from everything the reader's side could name it from.
/// </remarks>
[JsonPolymorphic(TypeDiscriminatorPropertyName = "kind")]
[JsonDerivedType(typeof(AdminHandoutTarget), typeDiscriminator: "handout")]
[JsonDerivedType(typeof(AdminProblemTarget), typeDiscriminator: "problem")]
public abstract record AdminDefenseTarget;

/// <inheritdoc cref="HandoutEnvironmentTarget" path="/summary"/>
/// <param name="HandoutContentId"><inheritdoc cref="HandoutEnvironmentTarget.HandoutContentId" path="/summary"/></param>
/// <param name="EnvironmentId"><inheritdoc cref="HandoutEnvironmentTarget.EnvironmentId" path="/summary"/></param>
public sealed record AdminHandoutTarget(string HandoutContentId, string EnvironmentId) : AdminDefenseTarget;

/// <summary>
/// The archive problem a conversation was held against, spelled out rather than pointed at, since the reader
/// has nothing to resolve a problem's identity against.
/// </summary>
/// <param name="Slug"><inheritdoc cref="EfCoreEntities.Problem.Slug" path="/summary"/></param>
/// <param name="Source"><inheritdoc cref="ProblemSource" path="/summary"/></param>
public sealed record AdminProblemTarget(string Slug, ProblemSource Source) : AdminDefenseTarget;

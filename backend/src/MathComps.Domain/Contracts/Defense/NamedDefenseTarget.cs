using System.Text.Json.Serialization;
using MathComps.Domain.Contracts.ProblemQuery;

namespace MathComps.Domain.Contracts.Defense;

/// <summary>
/// What a conversation was held against, as a surface reading conversations back names it. Exactly one arm
/// applies to any one conversation.
/// </summary>
/// <remarks>
/// The handout arm carries ids and the problem arm carries names, because the two are named from different
/// places: handout content is read on the reader's own side, while the taxonomy is not, and a competition
/// still under embargo is absent from everything the reader's side could name it from.
/// </remarks>
[JsonPolymorphic(TypeDiscriminatorPropertyName = "kind")]
[JsonDerivedType(typeof(NamedHandoutTarget), typeDiscriminator: "handout")]
[JsonDerivedType(typeof(NamedProblemTarget), typeDiscriminator: "problem")]
public abstract record NamedDefenseTarget;

/// <inheritdoc cref="HandoutEnvironmentTarget" path="/summary"/>
/// <param name="HandoutContentId"><inheritdoc cref="HandoutEnvironmentTarget.HandoutContentId" path="/summary"/></param>
/// <param name="EnvironmentId"><inheritdoc cref="HandoutEnvironmentTarget.EnvironmentId" path="/summary"/></param>
public sealed record NamedHandoutTarget(string HandoutContentId, string EnvironmentId) : NamedDefenseTarget;

/// <summary>
/// The archive problem a conversation was held against, named as well as addressed, since the reader has
/// nothing to resolve a problem's identity against.
/// </summary>
/// <param name="ProblemId"><inheritdoc cref="ProblemTarget.ProblemId" path="/summary"/></param>
/// <param name="CompetitionId">The competition it was set in, identified by the round it runs as.</param>
/// <param name="Slug"><inheritdoc cref="EfCoreEntities.Problem.Slug" path="/summary"/></param>
/// <param name="Source"><inheritdoc cref="ProblemSource" path="/summary"/></param>
public sealed record NamedProblemTarget(
    Guid ProblemId, Guid CompetitionId, string Slug, ProblemSource Source) : NamedDefenseTarget;

using System.Text.Json.Serialization;
using MathComps.Domain.Contracts.ProblemQuery;

namespace MathComps.Domain.Contracts.Defense;

/// <summary>
/// What a conversation was held against, as a surface reading conversations back names it. Exactly one arm
/// applies to any one conversation.
/// </summary>
/// <remarks>
/// The handout arm carries only ids, while the problem and proposal arms carry names alongside them, because the
/// kinds are named from different places: handout content is read on the reader's own side, while the taxonomy
/// is not, the proposals reach it only as part of the selection, and a competition still under embargo is
/// absent from everything the reader's side could name it from.
/// </remarks>
[JsonPolymorphic(TypeDiscriminatorPropertyName = "kind")]
[JsonDerivedType(typeof(NamedHandoutTarget), typeDiscriminator: "handout")]
[JsonDerivedType(typeof(NamedProblemTarget), typeDiscriminator: "problem")]
[JsonDerivedType(typeof(NamedProposalTarget), typeDiscriminator: "proposal")]
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
/// <param name="CompetitionSlug">
/// What addresses the competition it was set in, in the same language as the rest of the target's names.</param>
/// <param name="Slug">The problem's own address in the archive.</param>
/// <param name="Source"><inheritdoc cref="ProblemSource" path="/summary"/></param>
public sealed record NamedProblemTarget(
    Guid ProblemId, string CompetitionSlug, string Slug, ProblemSource Source) : NamedDefenseTarget;

/// <summary>
/// The proposal a conversation was held against: a problem the selection still holds, named by what the reviewers
/// quote it by.
/// </summary>
/// <param name="ProblemId"><inheritdoc cref="ProblemTarget.ProblemId" path="/summary"/></param>
/// <param name="Slug"><inheritdoc cref="EfCoreEntities.Problem.Slug" path="/summary"/></param>
/// <param name="Number"><inheritdoc cref="EfCoreEntities.Proposal.Number" path="/summary"/></param>
/// <param name="Title"><inheritdoc cref="EfCoreEntities.Proposal.Title" path="/summary"/></param>
public sealed record NamedProposalTarget(Guid ProblemId, string Slug, int Number, string Title) : NamedDefenseTarget;

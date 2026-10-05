using System.Text.Json.Serialization;

namespace MathComps.Domain.Contracts.Competitions;

/// <summary>
/// One student on one problem, as a competition's results show it to anybody.
/// </summary>
[JsonPolymorphic(TypeDiscriminatorPropertyName = "kind")]
[JsonDerivedType(typeof(NoConversationCellDto), typeDiscriminator: "none")]
[JsonDerivedType(typeof(PendingCellDto), typeDiscriminator: "pending")]
[JsonDerivedType(typeof(ScoredCellDto), typeDiscriminator: "scored")]
public abstract record ResultCellDto;

/// <summary>
/// A problem the student held no conversation about inside their entry, so there is nothing to mark.
/// </summary>
public sealed record NoConversationCellDto : ResultCellDto;

/// <summary>
/// A problem the student held a conversation about, with no final grade on it yet.
/// </summary>
public sealed record PendingCellDto : ResultCellDto;

/// <summary>
/// A problem whose grade is final.
/// </summary>
/// <param name="Score">The mark less half of the part that came from the examiner.</param>
public sealed record ScoredCellDto(decimal Score) : ResultCellDto;

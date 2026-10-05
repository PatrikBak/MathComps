using System.Text.Json.Serialization;

namespace MathComps.Domain.Contracts.Competitions;

/// <summary>
/// One student's entry into one competition: how it was spent, and when.
/// </summary>
[JsonPolymorphic(TypeDiscriminatorPropertyName = "kind")]
[JsonDerivedType(typeof(SatEntryDto), typeDiscriminator: "sat")]
[JsonDerivedType(typeof(ForfeitedEntryDto), typeDiscriminator: "forfeited")]
public abstract record HostedEntryDto;

/// <summary>
/// An entry the student sat, whether or not its clock has run out.
/// </summary>
/// <param name="StartedAt">When the student entered, which is when their clock started.</param>
/// <param name="FinishedAt"><inheritdoc cref="EfCoreEntities.HostedEntry.FinishedAt" path="/summary"/></param>
/// <param name="Cells">
/// The student's own cells, one per problem in the order the competition sets them; null until the group has
/// closed, and where nobody grades them.</param>
public sealed record SatEntryDto(
    DateTimeOffset StartedAt, DateTimeOffset? FinishedAt, IReadOnlyList<ResultCellDto>? Cells) : HostedEntryDto;

/// <summary>
/// An entry the student gave up to read the problems, so no clock ever ran.
/// </summary>
/// <param name="ForfeitedAt">When the student gave the entry up.</param>
public sealed record ForfeitedEntryDto(DateTimeOffset ForfeitedAt) : HostedEntryDto;

using MathComps.Domain.Contracts.Defense;

namespace MathComps.Domain.Contracts.Admin;

/// <summary>
/// One defense conversation: the statement and reference it ran on, and every turn.
/// </summary>
/// <param name="Id"><inheritdoc cref="AdminDefenseDetailDto.Id" path="/summary"/></param>
/// <param name="CreatedAt"><inheritdoc cref="AdminDefenseDetailDto.CreatedAt" path="/summary"/></param>
/// <param name="Statement"><inheritdoc cref="AdminDefenseDetailDto.Statement" path="/summary"/></param>
/// <param name="Reference"><inheritdoc cref="AdminDefenseDetailDto.Reference" path="/summary"/></param>
/// <param name="Turns"><inheritdoc cref="AdminDefenseDetailDto.Turns" path="/summary"/></param>
public record GradingConversationDto(
    Guid Id, DateTimeOffset CreatedAt, string Statement, string Reference, IReadOnlyList<DefenseTurnDto> Turns);

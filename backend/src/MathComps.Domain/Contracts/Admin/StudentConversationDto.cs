namespace MathComps.Domain.Contracts.Admin;

/// <summary>
/// One defense conversation a student held against a problem.
/// </summary>
/// <param name="Id"><inheritdoc cref="AdminDefenseDetailDto.Id" path="/summary"/></param>
/// <param name="CreatedAt"><inheritdoc cref="AdminDefenseDetailDto.CreatedAt" path="/summary"/></param>
public record StudentConversationDto(Guid Id, DateTimeOffset CreatedAt);

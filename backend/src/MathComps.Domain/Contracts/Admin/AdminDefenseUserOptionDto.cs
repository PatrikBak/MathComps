namespace MathComps.Domain.Contracts.Admin;

/// <summary>
/// One student the review queue can be filtered to.
/// </summary>
/// <param name="User"><inheritdoc cref="AdminDefenseUserDto" path="/summary"/></param>
/// <param name="ConversationCount">How many conversations they have held.</param>
public record AdminDefenseUserOptionDto(AdminDefenseUserDto User, int ConversationCount);

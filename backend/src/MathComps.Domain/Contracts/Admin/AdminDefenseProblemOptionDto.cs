namespace MathComps.Domain.Contracts.Admin;

/// <summary>
/// One problem the review queue can be filtered to.
/// </summary>
/// <param name="Target"><inheritdoc cref="AdminDefenseTarget" path="/summary"/></param>
/// <param name="ConversationCount">How many conversations have been held against it.</param>
public record AdminDefenseProblemOptionDto(AdminDefenseTarget Target, int ConversationCount);

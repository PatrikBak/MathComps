using MathComps.Domain.Contracts.Defense;

namespace MathComps.Domain.Contracts.Admin;

/// <summary>
/// One problem the review queue can be filtered to.
/// </summary>
/// <param name="Target"><inheritdoc cref="NamedDefenseTarget" path="/summary"/></param>
/// <param name="ConversationCount">How many conversations have been held against it.</param>
public record AdminDefenseProblemOptionDto(NamedDefenseTarget Target, int ConversationCount);

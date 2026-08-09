using MathComps.Domain.Contracts.Defense;

namespace MathComps.Domain.Contracts.Admin;

/// <summary>
/// One problem the review queue can be filtered to. It carries content ids rather than the row identity behind
/// them, since naming a problem takes handout content that lives outside this contract.
/// </summary>
/// <param name="Target"><inheritdoc cref="HandoutEnvironmentTarget" path="/summary"/></param>
/// <param name="ConversationCount">How many conversations have been held against it.</param>
public record AdminDefenseProblemOptionDto(HandoutEnvironmentTarget Target, int ConversationCount);

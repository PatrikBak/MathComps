namespace MathComps.Domain.Contracts.Defense;

/// <summary>
/// A request to open a defense conversation: which problem is being defended plus the student's first message.
/// The problem is named rather than supplied — its statement, reference solution and hints are resolved from the
/// site's own content — so the only text a caller contributes to the conversation is their own turn.
/// </summary>
/// <param name="Target"><inheritdoc cref="DefenseTarget" path="/summary"/></param>
/// <param name="Content">The student's first message.</param>
public record StartDefenseRequest(DefenseTarget Target, string Content);

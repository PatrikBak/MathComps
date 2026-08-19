namespace MathComps.Domain.Contracts.Defense;

/// <summary>
/// A summary of one defense conversation: its identity, what it was about, when it last moved, and where the
/// student got to.
/// </summary>
/// <param name="Id"><inheritdoc cref="DefenseSessionDto" path="/param[@name='Id']"/></param>
/// <param name="Target"><inheritdoc cref="HandoutEnvironmentTarget" path="/summary"/></param>
/// <param name="Statement">The problem statement as it stood when the session was started.</param>
/// <param name="LastActivityAt">When something was last said in the conversation.</param>
/// <param name="LastStudentMessage">
/// The student's most recent message, or null when the conversation holds no student turn.</param>
public record DefenseSessionListItemDto(
    Guid Id, HandoutEnvironmentTarget Target, string Statement, DateTimeOffset LastActivityAt,
    string? LastStudentMessage);

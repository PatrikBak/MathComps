namespace MathComps.Domain.Contracts.Defense;

/// <summary>
/// A summary of one defense conversation: its identity, what it was about, when it started, and how it opened.
/// </summary>
/// <param name="Id"><inheritdoc cref="DefenseSessionDto" path="/param[@name='Id']"/></param>
/// <param name="Target"><inheritdoc cref="HandoutEnvironmentTarget" path="/summary"/></param>
/// <param name="Statement">The problem statement as it stood when the session was started.</param>
/// <param name="CreatedAt">When the session was started.</param>
/// <param name="FirstStudentMessage">
/// The message the student opened with, or null when the conversation holds no student turn.</param>
public record DefenseSessionListItemDto(
    Guid Id, HandoutEnvironmentTarget Target, string Statement, DateTimeOffset CreatedAt,
    string? FirstStudentMessage);

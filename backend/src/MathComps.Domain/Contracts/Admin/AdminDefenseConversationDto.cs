using MathComps.Domain.Contracts.Defense;

namespace MathComps.Domain.Contracts.Admin;

/// <summary>
/// One defense conversation as the review queue lists it: who held it, what it was against, how it opened, and
/// every mark that decides whether it is worth opening.
/// </summary>
/// <param name="Id">The conversation's identifier.</param>
/// <param name="Target"><inheritdoc cref="HandoutEnvironmentTarget" path="/summary"/></param>
/// <param name="User"><inheritdoc cref="AdminDefenseUserDto" path="/summary"/></param>
/// <param name="OpeningMessage">
/// The start of the message the student opened with, cut short. Null when the conversation holds no student turn.
/// </param>
/// <param name="TurnCount">How many turns the conversation holds in total.</param>
/// <param name="LastActivityAt">When something was last said in it.</param>
/// <param name="ReadAt">When it was last read, or null while it never has been.</param>
/// <param name="UnreadTurnCount">
/// How many of its turns arrived after it was last read; every turn when it never has been.
/// </param>
/// <param name="NoteCount">How many notes have been written about it.</param>
/// <param name="HasStudentReport">Whether the student reported any of its replies.</param>
/// <param name="HasStudentFeedback">Whether the student said where it left them.</param>
public record AdminDefenseConversationDto(
    Guid Id,
    HandoutEnvironmentTarget Target,
    AdminDefenseUserDto User,
    string? OpeningMessage,
    int TurnCount,
    DateTimeOffset LastActivityAt,
    DateTimeOffset? ReadAt,
    int UnreadTurnCount,
    int NoteCount,
    bool HasStudentReport,
    bool HasStudentFeedback);

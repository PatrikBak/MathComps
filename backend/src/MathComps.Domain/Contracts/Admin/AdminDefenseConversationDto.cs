using MathComps.Domain.Contracts.Defense;

namespace MathComps.Domain.Contracts.Admin;

/// <summary>
/// One defense conversation as the review queue lists it: who held it, what it was against, where the student
/// got to, and every mark that decides whether it is worth opening.
/// </summary>
/// <param name="Id">The conversation's identifier.</param>
/// <param name="Target"><inheritdoc cref="NamedDefenseTarget" path="/summary"/></param>
/// <param name="User"><inheritdoc cref="AdminDefenseUserDto" path="/summary"/></param>
/// <param name="LastStudentMessage">
/// The start of the student's most recent message, cut short. Null when they have sent none.
/// </param>
/// <param name="StudentMessageCount">How many messages the student has sent in it.</param>
/// <param name="LastActivityAt">When something was last said in it.</param>
/// <param name="ReadAt">When it was last read, or null while it never has been.</param>
/// <param name="IsUnread">
/// Whether anything at all has arrived in it since it was last read, the examiner's replies included. A row can
/// stand unread with <paramref name="UnreadStudentMessageCount"/> at zero, so a conversation picked up again from
/// one of the examiner's replies has none of the student's own left in it.
/// </param>
/// <param name="UnreadStudentMessageCount">
/// How many of the student's messages arrived after it was last read; every one of them when it never has been.
/// </param>
/// <param name="NoteCount">How many notes have been written about it.</param>
/// <param name="HasStudentReport">Whether the student reported any of its replies.</param>
/// <param name="HasStudentFeedback">Whether the student said where it left them.</param>
public record AdminDefenseConversationDto(
    Guid Id,
    NamedDefenseTarget Target,
    AdminDefenseUserDto User,
    string? LastStudentMessage,
    int StudentMessageCount,
    DateTimeOffset LastActivityAt,
    DateTimeOffset? ReadAt,
    bool IsUnread,
    int UnreadStudentMessageCount,
    int NoteCount,
    bool HasStudentReport,
    bool HasStudentFeedback);

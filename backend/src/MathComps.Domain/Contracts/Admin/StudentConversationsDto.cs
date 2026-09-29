namespace MathComps.Domain.Contracts.Admin;

/// <summary>
/// One student's defense conversations on one problem, with how they are graded on it.
/// </summary>
/// <param name="Conversations">Every conversation the student held against the problem, oldest first.</param>
/// <param name="Grading">How the student is graded on the problem, or null when nobody grades them on it.</param>
public record StudentConversationsDto(
    IReadOnlyList<StudentConversationDto> Conversations, StudentGradingDto? Grading);

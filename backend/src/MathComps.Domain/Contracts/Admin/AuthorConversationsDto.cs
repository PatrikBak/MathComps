namespace MathComps.Domain.Contracts.Admin;

/// <summary>
/// One author's defense conversations on one problem, with how they are graded on it.
/// </summary>
/// <param name="Conversations">Every conversation the author held against the problem, oldest first.</param>
/// <param name="Grading">How the author is graded on the problem, or null when nobody grades them on it.</param>
public record AuthorConversationsDto(
    IReadOnlyList<AuthorConversationDto> Conversations, StudentGradingDto? Grading);

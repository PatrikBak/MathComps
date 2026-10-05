namespace MathComps.Domain.Contracts.Competitions;

/// <summary>
/// The conversation between the graders and one student about one grade.
/// </summary>
/// <param name="TargetId">The comment thread it is, <c>{problemId}:{userId}</c>.</param>
/// <param name="MessageCount">How many messages stand in it, replies included and deleted ones not.</param>
public record GradeConversationDto(string TargetId, int MessageCount);

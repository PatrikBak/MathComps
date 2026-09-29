namespace MathComps.Domain.Contracts.Admin;

/// <summary>
/// One entrant's grade on one problem as the board lists it.
/// </summary>
/// <param name="UserId">The entrant.</param>
/// <param name="ProblemId">The problem.</param>
/// <param name="ConversationCount">
/// How many conversations <see cref="StudentGradingDto.CountingConversationIds"/> holds for the entrant on the problem.
/// </param>
/// <param name="Grade"><inheritdoc cref="StudentGradingDto.Grade" path="/summary"/></param>
public record GradeSummaryDto(Guid UserId, Guid ProblemId, int ConversationCount, GradeDto? Grade);

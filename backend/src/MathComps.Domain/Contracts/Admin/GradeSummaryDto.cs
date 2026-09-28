namespace MathComps.Domain.Contracts.Admin;

/// <summary>
/// One entrant's grade on one problem as the board lists it.
/// </summary>
/// <param name="UserId">The entrant.</param>
/// <param name="ProblemId">The problem.</param>
/// <param name="ConversationCount">
/// How many conversations <see cref="GradeDetailDto.Conversations"/> holds for it.
/// </param>
/// <param name="Grade"><inheritdoc cref="GradeDetailDto.Grade" path="/summary"/></param>
public record GradeSummaryDto(Guid UserId, Guid ProblemId, int ConversationCount, GradeDto? Grade);

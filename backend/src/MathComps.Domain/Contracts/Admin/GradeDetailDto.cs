namespace MathComps.Domain.Contracts.Admin;

/// <summary>
/// One entrant's grade on one problem with everything it is read from.
/// </summary>
/// <param name="Conversations">The conversations the grade is read from, oldest first, each with every turn.</param>
/// <param name="SelfAssessment">
/// What the entrant said about their own solution, or null when they said nothing.
/// </param>
/// <param name="Grade">Where it stands, or null while nobody has given one.</param>
public record GradeDetailDto(
    IReadOnlyList<GradingConversationDto> Conversations, SelfAssessmentDto? SelfAssessment, GradeDto? Grade);

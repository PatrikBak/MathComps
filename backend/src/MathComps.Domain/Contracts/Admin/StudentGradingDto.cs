namespace MathComps.Domain.Contracts.Admin;

/// <summary>
/// One student's grade on one problem with what it is read from.
/// </summary>
/// <param name="CountingConversationIds">
/// The conversations the grade is read from: those the student started while their entry counted.
/// </param>
/// <param name="EndedAt">
/// When the entry stopped counting: its clock running out, or the student handing it in ahead of that. What they
/// said after it counts toward nothing, even inside a conversation the grade is read from.
/// </param>
/// <param name="Grade">Where it stands, or null while nobody has given one.</param>
/// <param name="SelfAssessment">
/// What the student said about their own solution, or null when they said nothing.
/// </param>
public record StudentGradingDto(
    IReadOnlyList<Guid> CountingConversationIds,
    DateTimeOffset EndedAt,
    GradeDto? Grade,
    SelfAssessmentDto? SelfAssessment);

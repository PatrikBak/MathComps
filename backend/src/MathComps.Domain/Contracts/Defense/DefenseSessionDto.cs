namespace MathComps.Domain.Contracts.Defense;

/// <summary>
/// A full defense conversation, as returned to the client.
/// </summary>
/// <param name="Id">The session's identifier.</param>
/// <param name="Target"><inheritdoc cref="DefenseTarget" path="/summary"/></param>
/// <param name="Turns">The conversation's turns, in order.</param>
/// <param name="Feedback"><inheritdoc cref="EfCoreEntities.DefenseSession.Feedback" path="/summary"/></param>
/// <param name="Reports"><inheritdoc cref="EfCoreEntities.DefenseSession.Reports" path="/summary"/></param>
public record DefenseSessionDto(
    Guid Id,
    DefenseTarget Target,
    IReadOnlyList<DefenseTurnDto> Turns,
    DefenseFeedbackDto? Feedback,
    IReadOnlyList<DefenseTurnReportDto> Reports);

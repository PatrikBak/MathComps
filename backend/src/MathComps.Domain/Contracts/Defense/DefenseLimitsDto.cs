namespace MathComps.Domain.Contracts.Defense;

/// <summary>
/// The caps a defense is held to, as far as a caller has to know them. Only the ones a student's own input runs
/// into: what they type, the photos they send with it and the size each is read at, and how far a conversation
/// can go.
/// </summary>
/// <param name="MaxCandidateChars">The longest a single student message may be, in characters.</param>
/// <param name="MaxFeedbackCommentChars">The longest a feedback comment may be, in characters.</param>
/// <param name="MaxMessagesPerDefense">The most messages the student may send in one conversation.</param>
/// <param name="MaxPhotosPerMessage">The most photos one message may carry.</param>
/// <param name="PhotoLongEdge">The most pixels a photo keeps along its longer side once read; a larger one is shrunk
/// to it.</param>
public record DefenseLimitsDto(
    int MaxCandidateChars,
    int MaxFeedbackCommentChars,
    int MaxMessagesPerDefense,
    int MaxPhotosPerMessage,
    int PhotoLongEdge);

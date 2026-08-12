namespace MathComps.Domain.Contracts.Defense;

/// <summary>
/// The caps a defense is held to, as far as a caller has to know them. Only the ones a student's own input runs
/// into: what they type, and how far a conversation can go.
/// </summary>
/// <param name="MaxCandidateChars">The longest a single student message may be, in characters.</param>
/// <param name="MaxFeedbackCommentChars">The longest a feedback comment may be, in characters.</param>
/// <param name="MaxTurnsPerSession">The most student turns one conversation may hold.</param>
public record DefenseLimitsDto(
    int MaxCandidateChars,
    int MaxFeedbackCommentChars,
    int MaxTurnsPerSession);

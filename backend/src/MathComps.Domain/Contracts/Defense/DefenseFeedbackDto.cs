using MathComps.Domain.EfCoreEntities;

namespace MathComps.Domain.Contracts.Defense;

/// <summary>
/// What a student said about a whole defense conversation, as returned to the client.
/// </summary>
/// <param name="Outcome">What the examiner did for them.</param>
/// <param name="Comment">What they said in their own words, or null when they let the outcome stand alone.</param>
public record DefenseFeedbackDto(DefenseOutcome Outcome, string? Comment);

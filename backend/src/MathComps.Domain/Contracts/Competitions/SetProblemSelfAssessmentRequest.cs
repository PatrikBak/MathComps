namespace MathComps.Domain.Contracts.Competitions;

/// <summary>
/// A student saying what they make of their own solution to one problem, or revising what they said before.
/// </summary>
/// <param name="Comment">What they want to say about it; the whole of the claim, so blank is refused.</param>
public record SetProblemSelfAssessmentRequest(string Comment);

using MathComps.Domain.EfCoreEntities;

namespace MathComps.Domain.Contracts.Defense;

/// <summary>
/// A request to record what a student says about a whole defense conversation, replacing anything they said
/// before. The session is identified by the URL route, so the body carries only the answer itself.
/// </summary>
/// <param name="Outcome">
/// What the examiner did for them. Nullable so that a body sending null arrives as nothing and is refused with the
/// feedback's own error, rather than failing to bind as a malformed body.
/// </param>
/// <param name="Comment">
/// What they say in their own words; absent when they let the outcome stand alone. Required alongside
/// <see cref="DefenseOutcome.SomethingElse"/>, which says nothing on its own.
/// </param>
public record SubmitDefenseFeedbackRequest(DefenseOutcome? Outcome, string? Comment);

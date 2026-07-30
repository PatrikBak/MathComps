namespace MathComps.Domain.Contracts.Defense;

/// <summary>
/// A request to rewind an open defense conversation, dropping every turn after a chosen point. The
/// session is identified by the URL route, so the body carries only the cut point.
/// </summary>
/// <param name="KeepThroughSequence">
/// The sequence of the last turn to keep; every later turn is deleted. Nullable so that a body leaving it out
/// arrives as nothing rather than as the opener, which is what stops it wiping the conversation.
/// </param>
public record RewindDefenseRequest(int? KeepThroughSequence);

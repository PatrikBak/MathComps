namespace MathComps.Domain.Contracts.Defense;

/// <summary>
/// A request to rewind an open defense conversation, dropping every turn after a chosen point. The
/// session is identified by the URL route, so the body carries only the cut point.
/// </summary>
/// <param name="KeepThroughSequence">The sequence of the last turn to keep; every later turn is deleted.</param>
public record RewindDefenseRequest(int KeepThroughSequence);

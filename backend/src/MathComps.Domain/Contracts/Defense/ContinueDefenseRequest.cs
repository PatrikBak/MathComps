namespace MathComps.Domain.Contracts.Defense;

/// <summary>
/// A request to continue an open defense conversation with the student's next message. The session is identified
/// by the URL route, so the body carries only the message and its photos.
/// </summary>
/// <param name="Content">The student's next message.</param>
/// <param name="PhotoIds"><inheritdoc cref="StartDefenseRequest" path="/param[@name='PhotoIds']"/></param>
public record ContinueDefenseRequest(string Content, IReadOnlyList<Guid>? PhotoIds = null);

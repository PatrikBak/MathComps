namespace MathComps.Domain.Contracts.Defense;

/// <summary>
/// A request naming the problem a composer is on, for the phone photo handoff: the one to point the student's code
/// at, or the one whose waiting pages to take.
/// </summary>
/// <param name="Target">The problem the composer is on.</param>
public record DefensePhotoHandoffRequest(DefenseTarget Target);

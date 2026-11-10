namespace MathComps.Domain.Contracts.Defense;

/// <summary>
/// The pages the student's phone sent to one problem that no composer had taken yet, now taken, and whether their
/// code still works.
/// </summary>
/// <param name="Pages">The pages, in the order the phone captured them.</param>
/// <param name="HasLiveCode">Whether the student has a handoff code that still works.</param>
public record DefensePhotoHandoffPagesDto(IReadOnlyList<DefensePhotoHandoffPageDto> Pages, bool HasLiveCode);

using MathComps.Domain.Contracts.Defense;

namespace MathComps.Domain.Contracts.Selection;

/// <summary>
/// One conversation with the examiner about a proposal, read out in full.
/// </summary>
/// <param name="SavedStatement">The statement as it stood when the conversation started.</param>
/// <param name="Turns">Everything said, in order.</param>
public record ReviewTranscriptDto(string SavedStatement, IReadOnlyList<DefenseTurnDto> Turns);

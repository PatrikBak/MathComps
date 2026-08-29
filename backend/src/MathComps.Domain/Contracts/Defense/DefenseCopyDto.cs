namespace MathComps.Domain.Contracts.Defense;

/// <summary>
/// The examiner's canned lines, in the reader's language.
/// </summary>
/// <param name="Opener">The greeting that opens every conversation.</param>
public record DefenseCopyDto(string Opener);

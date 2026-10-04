namespace MathComps.Domain.Contracts.Selection;

/// <summary>
/// One proposal's text in one language.
/// </summary>
/// <param name="Statement">The statement as markdown.</param>
/// <param name="Solution">The full solution as markdown, or null where nobody has written one in this language.</param>
/// <param name="Hints">The author's hints as markdown, weakest nudge first; empty where none were written.</param>
public record ProposalTextDto(string Statement, string? Solution, IReadOnlyList<string> Hints);

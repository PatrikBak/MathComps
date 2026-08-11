namespace MathComps.Infrastructure.Services.Defense.Content;

/// <summary>
/// Everything the examiner is told about one handout environment, in the language the student is reading it in.
/// </summary>
/// <param name="Statement">The problem statement, seen by both sides.</param>
/// <param name="Reference">The reference solution the examiner reasons from.</param>
/// <param name="Hints">The author's step-by-step hints, in order; empty when the problem has none.</param>
public sealed record DefenseProblemContent(string Statement, string Reference, IReadOnlyList<string> Hints);

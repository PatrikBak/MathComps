using MathComps.Domain.EfCoreEntities;

namespace MathComps.Infrastructure.Services.Defense.Content;

/// <summary>
/// Everything the examiner is told about one defended problem: its statement, reference and hints in one language,
/// and the author's grading note in whichever language it was written.
/// </summary>
/// <param name="Statement">The problem statement, seen by both sides.</param>
/// <param name="Reference">The reference solution the examiner reasons from.</param>
/// <param name="Hints">The author's step-by-step hints, in order; empty when the problem has none.</param>
/// <param name="GradingNote">The problem's <see cref="DocumentType.GradingNote"/>; null when it has none.</param>
public sealed record DefenseProblemContent(
    string Statement, string Reference, IReadOnlyList<string> Hints, string? GradingNote);

using System.Linq.Expressions;
using MathComps.Domain.EfCoreEntities;
using MathComps.Domain.Localization;

namespace MathComps.Infrastructure.Services.Competitions;

/// <summary>
/// What a problem has to be written in before a hosted round can carry it: a statement and a solution in every
/// language the site is read in. The site serves the statement, the examiner reasons from the solution, and
/// nothing downstream has a fallback for a language a problem was never written in.
/// </summary>
public static class HostedProblemTexts
{
    /// <summary>
    /// How many statements and solutions a problem written in every language carries. A problem text is unique in
    /// its problem, kind and language together, so anything short of this is a gap rather than a repeat.
    /// </summary>
    private static readonly int _completeTextCount = Enum.GetValues<Language>().Length * 2;

    /// <summary>
    /// Whether a problem lacks a statement or a solution in some language the site is read in. A text with no
    /// markdown, or markdown holding nothing but whitespace, counts as lacking.
    /// </summary>
    public static Expression<Func<Problem, bool>> IsIncomplete { get; } = problem =>
        // Its statements and solutions whose markdown says something, counted against one of each per language
        problem.Texts.Count(text =>
            (text.DocumentType == DocumentType.Statement || text.DocumentType == DocumentType.Solution)
            && !string.IsNullOrWhiteSpace(text.MarkdownText))
        < _completeTextCount;
}

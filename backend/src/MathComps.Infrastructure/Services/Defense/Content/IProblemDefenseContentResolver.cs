using MathComps.Domain.Contracts.Defense;
using MathComps.Domain.Localization;

namespace MathComps.Infrastructure.Services.Defense.Content;

/// <summary>
/// Resolves what the examiner is told about an archive problem.
/// </summary>
public interface IProblemDefenseContentResolver
{
    /// <summary>
    /// Resolves the current content behind an archive problem, in one language.
    /// </summary>
    /// <param name="target">The problem to resolve.</param>
    /// <param name="language">The language the student is reading the problem in.</param>
    /// <param name="cancellationToken">Cancels the lookup.</param>
    /// <returns>
    /// The problem's content, or null when the problem is unknown or has no statement or solution in that language.
    /// </returns>
    Task<DefenseProblemContent?> ResolveAsync(
        ProblemTarget target, Language language, CancellationToken cancellationToken);
}

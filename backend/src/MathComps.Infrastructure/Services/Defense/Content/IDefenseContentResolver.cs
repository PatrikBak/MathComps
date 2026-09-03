using MathComps.Domain.Contracts.Defense;
using MathComps.Domain.Localization;

namespace MathComps.Infrastructure.Services.Defense.Content;

/// <summary>
/// Looks up what the examiner is told about a problem, from whatever the defense is held against. Resolution is a
/// point-in-time read, so an edit to the source reaches the next defense of that problem and never an open one.
/// </summary>
public interface IDefenseContentResolver
{
    /// <summary>
    /// Resolves the current content behind a defense target, in one language.
    /// </summary>
    /// <param name="target">What the defense is held against.</param>
    /// <param name="language">The language the student is reading in.</param>
    /// <param name="cancellationToken">Cancels the lookup.</param>
    /// <returns>The target's content, or null when the target names nothing defendable in that language.</returns>
    Task<DefenseProblemContent?> ResolveAsync(
        DefenseTarget target, Language language, CancellationToken cancellationToken);
}

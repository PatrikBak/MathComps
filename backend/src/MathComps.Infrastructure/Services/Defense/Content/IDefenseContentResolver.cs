using MathComps.Domain.Contracts.Defense;
using MathComps.Domain.Localization;

namespace MathComps.Infrastructure.Services.Defense.Content;

/// <summary>
/// Looks up what the examiner is told about a problem from the handout environment it lives in, so a defense is
/// held against the site's own content rather than against whatever text a caller supplied. Resolution is a
/// point-in-time read: a session snapshots what it gets, so an edit to the source reaches the next defense of that
/// problem and never an open one.
/// </summary>
public interface IDefenseContentResolver
{
    /// <summary>
    /// Resolves the current content behind a handout environment, in one language.
    /// </summary>
    /// <param name="target">The handout environment to resolve.</param>
    /// <param name="language">The language the student is reading the handout in.</param>
    /// <param name="cancellationToken">Cancels the lookup.</param>
    /// <returns>The environment's content, or null when the handout, the language or the environment is unknown.</returns>
    Task<DefenseProblemContent?> ResolveAsync(
        HandoutEnvironmentTarget target, Language language, CancellationToken cancellationToken);
}

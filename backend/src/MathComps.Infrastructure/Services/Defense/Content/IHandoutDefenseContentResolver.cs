using MathComps.Domain.Contracts.Defense;
using MathComps.Domain.Localization;

namespace MathComps.Infrastructure.Services.Defense.Content;

/// <summary>
/// Resolves what the examiner is told about a handout environment.
/// </summary>
public interface IHandoutDefenseContentResolver
{
    /// <summary>
    /// Resolves the current content behind a handout environment, in one language.
    /// </summary>
    /// <param name="target">The handout environment to resolve.</param>
    /// <param name="language">The language the student is reading the handout in.</param>
    /// <param name="cancellationToken">Cancels the lookup.</param>
    /// <returns>
    /// The environment's content, or null when the handout, the language or the environment is unknown.
    /// </returns>
    Task<DefenseProblemContent?> ResolveAsync(
        HandoutEnvironmentTarget target, Language language, CancellationToken cancellationToken);
}

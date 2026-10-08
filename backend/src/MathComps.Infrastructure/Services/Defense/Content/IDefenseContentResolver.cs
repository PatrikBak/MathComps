using MathComps.Domain.Contracts.Defense;
using MathComps.Domain.Localization;

namespace MathComps.Infrastructure.Services.Defense.Content;

/// <summary>
/// Looks up what the examiner is told about a problem, from what a defense is held against. Resolution is a
/// point-in-time read, so an edit to the source reaches the next defense of that problem and never an open one.
/// </summary>
/// <typeparam name="TTarget">The kind of defense target resolved.</typeparam>
public interface IDefenseContentResolver<in TTarget> where TTarget : DefenseTarget
{
    /// <summary>
    /// Resolves the current content behind a defense target, in one language.
    /// </summary>
    /// <param name="target">What the defense is held against.</param>
    /// <param name="language">The language the student is reading in.</param>
    /// <param name="cancellationToken">Cancels the lookup.</param>
    /// <returns>The target's content, or null when the target names nothing defendable in that language.</returns>
    Task<DefenseProblemContent?> ResolveAsync(TTarget target, Language language, CancellationToken cancellationToken);

    /// <summary>
    /// Resolves the statement a defense target has now, in each language it has one in.
    /// </summary>
    /// <param name="target">What the defense is held against.</param>
    /// <param name="cancellationToken">Cancels the lookup.</param>
    /// <returns>The statements by language; empty when the target has none.</returns>
    Task<IReadOnlyDictionary<Language, string>> ResolveStatementsAsync(
        TTarget target, CancellationToken cancellationToken);
}

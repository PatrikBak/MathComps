using MathComps.Domain.Contracts.Defense;
using MathComps.Domain.Localization;

namespace MathComps.Infrastructure.Services.Defense.Content;

/// <summary>
/// The <see cref="IDefenseContentResolver{TTarget}"/> every defense goes through, taking any kind of target: it reads
/// which kind it was given and hands the lookup to the resolver that knows that source.
/// </summary>
/// <param name="handoutResolver">Resolves handout environments.</param>
/// <param name="problemResolver">Resolves archive problems.</param>
public sealed class DefenseContentResolver(
    IDefenseContentResolver<HandoutEnvironmentTarget> handoutResolver,
    IDefenseContentResolver<ProblemTarget> problemResolver)
    : IDefenseContentResolver<DefenseTarget>
{
    /// <inheritdoc/>
    public Task<DefenseProblemContent?> ResolveAsync(
        DefenseTarget target, Language language, CancellationToken cancellationToken)
        // Whichever source the target names.
        => target switch
        {
            HandoutEnvironmentTarget handout => handoutResolver.ResolveAsync(handout, language, cancellationToken),
            ProblemTarget problem => problemResolver.ResolveAsync(problem, language, cancellationToken),

            // An unhandled target kind is a wiring bug, and failing loudly beats quietly resolving to nothing.
            _ => throw new ArgumentOutOfRangeException(nameof(target), target, "Unknown defense target."),
        };

    /// <inheritdoc/>
    public Task<IReadOnlyDictionary<Language, string>> ResolveStatementsAsync(
        DefenseTarget target, CancellationToken cancellationToken)
        // Whichever source the target names.
        => target switch
        {
            HandoutEnvironmentTarget handout => handoutResolver.ResolveStatementsAsync(handout, cancellationToken),
            ProblemTarget problem => problemResolver.ResolveStatementsAsync(problem, cancellationToken),

            // An unhandled target kind is a wiring bug, and failing loudly beats quietly resolving to nothing.
            _ => throw new ArgumentOutOfRangeException(nameof(target), target, "Unknown defense target."),
        };
}

using MathComps.Domain.Contracts.Defense;
using MathComps.Domain.Localization;

namespace MathComps.Infrastructure.Services.Defense.Content;

/// <summary>
/// The <see cref="IDefenseContentResolver"/> every defense goes through: it reads which kind of target it was
/// given and hands the lookup to the resolver that knows that source.
/// </summary>
/// <param name="handoutResolver">Resolves handout environments.</param>
/// <param name="problemResolver">Resolves archive problems.</param>
public sealed class DefenseContentResolver(
    IHandoutDefenseContentResolver handoutResolver,
    IProblemDefenseContentResolver problemResolver)
    : IDefenseContentResolver
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
}

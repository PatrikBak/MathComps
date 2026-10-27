using MathComps.Domain.EfCoreEntities;
using MathComps.Domain.Taxonomy;
using MathComps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace MathComps.Infrastructure.Services.Problems;

/// <summary>
/// Shared steps for moving a problem between positions. A problem's position is its round and its number there,
/// and its slug is derived from both, so anything moving a problem has to write all three together and keep the slug
/// unique. The lock here runs the writes that take it one at a time.
/// </summary>
public static class ProblemPositions
{
    /// <summary>
    /// The key of the advisory lock <see cref="LockAsync"/> takes, any number nothing else locks on.
    /// </summary>
    private const long LockKey = 7_300_515_181;

    /// <summary>
    /// Waits until no other transaction holds the lock. The lock lets go when the caller's transaction ends, so no
    /// other write taking the lock can change what the caller reads after this until the caller commits.
    /// </summary>
    /// <param name="context">The context the caller's write runs on, inside a transaction.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>A task that completes once the lock is held.</returns>
    public static async Task LockAsync(MathCompsDbContext context, CancellationToken cancellationToken) =>
        // Held until the transaction commits or rolls back
        await context.Database.ExecuteSqlAsync($"SELECT pg_advisory_xact_lock({LockKey})", cancellationToken);

    /// <summary>
    /// Derives the slug a problem carries at a position, from the competition and season the round belongs to.
    /// </summary>
    /// <param name="round">The round, with its competition and season loaded.</param>
    /// <param name="number"><inheritdoc cref="Problem.Number" path="/summary"/></param>
    /// <returns>The slug that position calls for.</returns>
    public static string SlugAt(Round round, int number) =>
        // The same formula the import builds a draft's slugs with, so a re-import of the paper a problem moved into
        // matches.
        TaxonomySlugs.ProblemSlug(
            Season.EditionFromStartYear(round.Season.StartYear), round.Competition.Path, number);

    /// <summary>
    /// Refuses slugs that a problem outside a move already carries. Nothing enforces slug uniqueness in the
    /// schema, while the import resolves a draft to one problem by slug, so a second row holding one turns the next
    /// import of either problem into a failure whose cause sits nowhere near the draft being imported.
    /// </summary>
    /// <param name="context">The context the move runs on.</param>
    /// <param name="slugs">The slugs the move would write.</param>
    /// <param name="movingIds">The problems being moved, which may hold those slugs today.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>A task representing the check.</returns>
    /// <exception cref="ProblemSlugTakenException">
    /// Thrown when a problem outside the move carries one of the slugs.
    /// </exception>
    public static async Task RefuseSlugCollisionAsync(
        MathCompsDbContext context, IReadOnlyCollection<string> slugs, IReadOnlyCollection<Guid> movingIds,
        CancellationToken cancellationToken)
    {
        // A slug a problem outside the move already answers to, if any.
        var taken = await context.Problems
            .Where(candidate => slugs.Contains(candidate.Slug) && !movingIds.Contains(candidate.Id))
            .Select(candidate => candidate.Slug)
            .FirstOrDefaultAsync(cancellationToken);

        // Writing it would leave two problems answering to one slug, which the next import of either would hit.
        if (taken is not null)
            throw new ProblemSlugTakenException(taken);
    }
}

/// <summary>
/// Thrown when a move would write a slug a problem outside it already carries.
/// </summary>
/// <param name="slug">The slug already taken.</param>
public sealed class ProblemSlugTakenException(string slug)
    : MathCompsException(
        $"The slug '{slug}' is already carried by another problem, so the move would leave two problems "
        + "answering to it.",
        RefusalKind.Conflict,
        LogLevel.Error);

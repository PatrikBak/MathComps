using MathComps.Domain.EfCoreEntities;
using MathComps.Domain.Taxonomy;
using MathComps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace MathComps.Infrastructure.Services.Problems;

/// <summary>
/// Moves problems between positions. A problem's position is its round and its number there, and its slug is
/// derived from both, so anything moving a problem has to write all three together, keep the slug unique, and
/// wait for every other move to finish.
/// </summary>
public static class ProblemPositions
{
    /// <summary>
    /// The key of the advisory lock every move takes, any number nothing else locks on.
    /// </summary>
    private const long LockKey = 7_300_515_181;

    /// <summary>
    /// The number a problem is parked on while the other one claims the slot it vacated: a slot no real paper
    /// reaches, and one the positive-number check on the column accepts.
    /// </summary>
    private const int ParkingNumber = int.MaxValue;

    /// <summary>
    /// Waits until no other move is running. The lock lets go when the caller's transaction ends, so no other move
    /// can change what the caller reads after this until it commits.
    /// </summary>
    /// <param name="context">The context the move runs on, inside a transaction.</param>
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
        // The same formula the import builds a draft's slugs with, so a re-import of the rearranged paper matches.
        TaxonomySlugs.ProblemSlug(
            Season.EditionFromStartYear(round.Season.StartYear), round.Competition.Path, number);

    /// <summary>
    /// Works out what two problems trading positions would write, refusing the trade when a slug either would take
    /// on is already carried by a third problem.
    /// </summary>
    /// <param name="context">The context the trade runs on.</param>
    /// <param name="first">The first problem, with its round, competition and season loaded.</param>
    /// <param name="second">The second problem, with its round, competition and season loaded.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>The slug each one takes on in the other's position.</returns>
    /// <exception cref="ProblemSlugTakenException">Thrown when a slug the trade writes is already taken.</exception>
    public static async Task<ProblemExchange> PlanExchangeAsync(
        MathCompsDbContext context, Problem first, Problem second, CancellationToken cancellationToken)
    {
        // The slug each one takes on at the position it lands on, keyed by the destination round's competition and
        // season and by the number it inherits there.
        var exchange = new ProblemExchange(
            SlugAt(second.Round, second.Number),
            SlugAt(first.Round, first.Number));

        // Neither slug may already answer for a problem outside the trade; the two trading may hold either today.
        await RefuseSlugCollisionAsync(
            context, [exchange.FirstNewSlug, exchange.SecondNewSlug], [first.Id, second.Id], cancellationToken);

        // What the trade writes.
        return exchange;
    }

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

    /// <summary>
    /// Moves each problem onto the other's round and number, writing the slug that position calls for. It runs
    /// inside a transaction the caller holds, so nothing can observe a parked row.
    /// </summary>
    /// <remarks>
    /// The unique index over (round, number) is checked per statement rather than at commit, so the two rows cannot
    /// trade numbers in one batch and EF does not order the updates within one anyway. The first problem is parked
    /// and flushed on its own, which frees its slot for the second, and the second is flushed before the first
    /// claims the slot it vacated. Each flush also saves whatever else the context is tracking.
    /// </remarks>
    /// <param name="context">The context the trade runs on, tracking both problems.</param>
    /// <param name="first">The first problem in the trade.</param>
    /// <param name="second">The second problem in the trade.</param>
    /// <param name="exchange">The slugs the two take on in each other's positions.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>A task representing the trade.</returns>
    public static async Task ExchangeAsync(
        MathCompsDbContext context, Problem first, Problem second, ProblemExchange exchange,
        CancellationToken cancellationToken)
    {
        // Where each one is headed, captured before either is moved off it.
        var (firstRoundId, firstNumber) = (first.RoundId, first.Number);
        var (secondRoundId, secondNumber) = (second.RoundId, second.Number);

        // Park the first problem, freeing the slot the second is about to claim.
        first.Number = ParkingNumber;
        await context.SaveChangesAsync(cancellationToken);

        // Move the second onto the slot the first just vacated.
        second.RoundId = firstRoundId;
        second.Number = firstNumber;
        second.Slug = exchange.SecondNewSlug;
        await context.SaveChangesAsync(cancellationToken);

        // Move the first onto the slot the second vacated, off the parking number.
        first.RoundId = secondRoundId;
        first.Number = secondNumber;
        first.Slug = exchange.FirstNewSlug;
        await context.SaveChangesAsync(cancellationToken);
    }
}

/// <summary>
/// The slugs two problems take on when they trade positions.
/// </summary>
/// <param name="FirstNewSlug">The slug the first problem takes on in the second's position.</param>
/// <param name="SecondNewSlug">The slug the second problem takes on in the first's position.</param>
public sealed record ProblemExchange(string FirstNewSlug, string SecondNewSlug);

/// <summary>
/// Thrown when a move would write a slug a problem outside it already carries.
/// </summary>
/// <param name="slug">The slug already taken.</param>
public sealed class ProblemSlugTakenException(string slug)
    : Exception($"The slug '{slug}' is already carried by another problem, so the move would leave two problems "
        + "answering to it.");

using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace MathComps.Infrastructure.Services.Competitions;

/// <summary>
/// The rule saying who may read a hosted competition's problems, stated once for everything that has to ask it.
/// </summary>
public static class HostedEntryRules
{
    /// <summary>
    /// Throws unless the student may read a round's problems: its embargo has passed, or they hold an entry they
    /// have spent into it.
    /// </summary>
    /// <param name="dbContext">The caller's database context.</param>
    /// <param name="userId">The student reading.</param>
    /// <param name="roundId">The round whose problems they are reaching for.</param>
    /// <param name="visibleSince"><inheritdoc cref="Round.VisibleSince" path="/summary"/></param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    public static async Task EnsureEntitledAsync(
        MathCompsDbContext dbContext, Guid userId, Guid roundId, DateTimeOffset? visibleSince,
        CancellationToken cancellationToken)
    {
        // Once the embargo has passed the problems are public, and there is nothing left to hold back.
        if (visibleSince is null || visibleSince <= DateTimeOffset.UtcNow)
            return;

        // Otherwise the student needs an entry they have spent, whichever way they spent it.
        var hasEntry = await dbContext.HostedEntries
            .AsNoTracking()
            .AnyAsync(entry => entry.UserId == userId && entry.RoundId == roundId, cancellationToken);

        // Nothing spent, nothing to read.
        if (!hasEntry)
            throw new HostedEntryRequiredException();
    }

    /// <summary>
    /// Whether the official solution to a round's problems may be put in front of a student: a clock of theirs
    /// still running is what holds it back.
    /// </summary>
    /// <remarks>
    /// Everything else opens it: an entry they handed in, a clock that ran out, an entry they gave up for the
    /// problems, and a competition that has closed, which anybody may then read.
    ///
    /// The round's embargo is a separate gate, deciding whether the problems may be reached at all, and
    /// <see cref="EnsureEntitledAsync"/> has settled it by the time anything asks this.
    /// </remarks>
    /// <param name="startedAt"><inheritdoc cref="HostedEntry.StartedAt" path="/summary"/></param>
    /// <param name="finishedAt"><inheritdoc cref="HostedEntry.FinishedAt" path="/summary"/></param>
    /// <param name="clockMinutes"><inheritdoc cref="HostedGroup.ClockMinutes" path="/summary"/></param>
    /// <param name="now">The instant to read the clock against.</param>
    /// <returns>Whether the solution may be served.</returns>
    public static bool IsSolutionOpen(
        DateTimeOffset? startedAt, DateTimeOffset? finishedAt, int clockMinutes, DateTimeOffset now)
    {
        // No clock ever ran, so there is no run of theirs to hold anything back from: the entry was given up
        // for the problems.
        if (startedAt is not { } clockStartedAt)
            return true;

        // Closed by the student, whatever they left on the clock.
        if (finishedAt is not null)
            return true;

        // Otherwise the clock says it: one still running is a student still competing.
        return clockStartedAt.AddMinutes(clockMinutes) <= now;
    }
}

/// <summary>
/// Thrown when a student reaches for a competition's problems without having spent an entry into it.
/// </summary>
public sealed class HostedEntryRequiredException() : Exception("This competition has not been entered");

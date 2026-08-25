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
}

/// <summary>
/// Thrown when a student reaches for a competition's problems without having spent an entry into it.
/// </summary>
public sealed class HostedEntryRequiredException() : Exception("This competition has not been entered");

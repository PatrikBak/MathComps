using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Options;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Ai;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace MathComps.Infrastructure.Services.Defense;

/// <summary>
/// The record of what a student's defense work billed: the daily ceiling every action that costs a model call is
/// weighed against, and the <see cref="DefenseSpend"/> row each such action writes. A turn and a photo reading go
/// through here alike, so they are refused identically and recorded identically.
/// </summary>
internal static class DefenseSpendLedger
{
    /// <summary>
    /// Throws when what the user has spent today against their daily ceiling has reached it.
    /// </summary>
    /// <param name="dbContext">The operation's database context to query.</param>
    /// <param name="userId">The user to check.</param>
    /// <param name="ceiling"><inheritdoc cref="DefenseLimits.DailySpendCeilingPerUser" path="/summary"/></param>
    /// <param name="cancellationToken">A token to cancel the query.</param>
    /// <returns>A task that completes once the user is known to be under the ceiling.</returns>
    /// <exception cref="DefenseSpendLimitException">Thrown when the user is at or over the ceiling.</exception>
    public static async Task EnsureUnderCeilingAsync(
        MathCompsDbContext dbContext, Guid userId, decimal ceiling, CancellationToken cancellationToken)
    {
        // The start of today, in UTC.
        var dayStart = new DateTimeOffset(DateTime.UtcNow.Date, TimeSpan.Zero);

        // Sum the user's spend since then, leaving out a defense they hold an entry into, which is exempt.
        var spent = await dbContext.DefenseSpends
            .Where(spend =>
                spend.UserId == userId && spend.CountsAgainstCeiling && spend.CreatedAt >= dayStart)
            .SumAsync(spend => spend.Cost, cancellationToken);

        // Refuse once the ceiling is reached.
        if (spent >= ceiling)
            throw new DefenseSpendLimitException();
    }

    /// <summary>
    /// Stages the row recording what one examiner turn billed, for the caller's save to write.
    /// </summary>
    /// <param name="dbContext">The operation's database context to stage the row on.</param>
    /// <param name="userId"><inheritdoc cref="DefenseSpend.UserId" path="/summary"/></param>
    /// <param name="usage">What the turn's model calls billed.</param>
    /// <param name="durationMs">How long the turn's engine run took, in milliseconds.</param>
    /// <param name="revisions">How many times the turn's reply was regenerated because a guard flagged it.</param>
    /// <param name="countsAgainstCeiling"><inheritdoc cref="DefenseSpend.CountsAgainstCeiling" path="/summary"/></param>
    /// <param name="createdAt"><inheritdoc cref="DefenseSpend.CreatedAt" path="/summary"/></param>
    public static void RecordTurn(
        MathCompsDbContext dbContext,
        Guid userId,
        ModelUsage usage,
        int durationMs,
        int revisions,
        bool countsAgainstCeiling,
        DateTimeOffset createdAt) =>
        // A turn's row, naming no photo
        Record(dbContext, userId, usage, durationMs, revisions, countsAgainstCeiling, photoId: null, createdAt);

    /// <summary>
    /// Stages the row recording what reading one photo billed, for the caller's save to write.
    /// </summary>
    /// <param name="dbContext">The operation's database context to stage the row on.</param>
    /// <param name="userId"><inheritdoc cref="DefenseSpend.UserId" path="/summary"/></param>
    /// <param name="usage">What the reading's model call billed.</param>
    /// <param name="durationMs">How long the reading took, in milliseconds.</param>
    /// <param name="countsAgainstCeiling"><inheritdoc cref="DefenseSpend.CountsAgainstCeiling" path="/summary"/></param>
    /// <param name="photoId">The photo read.</param>
    /// <param name="createdAt"><inheritdoc cref="DefenseSpend.CreatedAt" path="/summary"/></param>
    public static void RecordReading(
        MathCompsDbContext dbContext,
        Guid userId,
        ModelUsage usage,
        int durationMs,
        bool countsAgainstCeiling,
        Guid photoId,
        DateTimeOffset createdAt) =>
        // A reading's row, which no guard ever redrafts
        Record(dbContext, userId, usage, durationMs, revisions: 0, countsAgainstCeiling, photoId, createdAt);

    /// <summary>
    /// Stages one spend row, for the caller's save to write.
    /// </summary>
    /// <param name="dbContext">The operation's database context to stage the row on.</param>
    /// <param name="userId"><inheritdoc cref="DefenseSpend.UserId" path="/summary"/></param>
    /// <param name="usage">What the work's model calls billed.</param>
    /// <param name="durationMs"><inheritdoc cref="DefenseSpend.DurationMs" path="/summary"/></param>
    /// <param name="revisions"><inheritdoc cref="DefenseSpend.Revisions" path="/summary"/></param>
    /// <param name="countsAgainstCeiling"><inheritdoc cref="DefenseSpend.CountsAgainstCeiling" path="/summary"/></param>
    /// <param name="photoId"><inheritdoc cref="DefenseSpend.PhotoId" path="/summary"/></param>
    /// <param name="createdAt"><inheritdoc cref="DefenseSpend.CreatedAt" path="/summary"/></param>
    private static void Record(
        MathCompsDbContext dbContext,
        Guid userId,
        ModelUsage usage,
        int durationMs,
        int revisions,
        bool countsAgainstCeiling,
        Guid? photoId,
        DateTimeOffset createdAt) =>
        // The spend fact, independent of any conversation so it outlives one
        dbContext.DefenseSpends.Add(new DefenseSpend
        {
            UserId = userId,
            Cost = usage.Cost,
            PromptTokens = usage.PromptTokens,
            CompletionTokens = usage.CompletionTokens,
            ReasoningTokens = usage.ReasoningTokens,
            CachedPromptTokens = usage.CachedPromptTokens,
            DurationMs = durationMs,
            Revisions = revisions,
            CountsAgainstCeiling = countsAgainstCeiling,
            PhotoId = photoId,
            CreatedAt = createdAt,
        });
}

/// <summary>
/// Thrown when the user has reached their configured daily spend ceiling.
/// </summary>
public sealed class DefenseSpendLimitException()
    : MathCompsException(
        "You have reached your usage limit. Try again later.",
        RefusalKind.Throttled,
        LogLevel.Information);

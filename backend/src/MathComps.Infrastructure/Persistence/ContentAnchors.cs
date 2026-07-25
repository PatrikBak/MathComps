using FlexLabs.EntityFrameworkCore.Upsert;
using MathComps.Domain.EfCoreEntities;
using Microsoft.EntityFrameworkCore;

namespace MathComps.Infrastructure.Persistence;

/// <summary>
/// Resolves the anchor rows that file-based content hangs off. A handout, a news article, and one environment
/// inside a handout all live outside the database, so the row standing in for one is minted the first time
/// anything is attached to it and reused by everything after.
/// </summary>
public static class ContentAnchors
{
    /// <summary>
    /// Resolves the anchor row for a file-based handout.
    /// </summary>
    /// <param name="dbContext">The operation's database context.</param>
    /// <param name="contentId">The handout's permanent content id.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>The handout anchor row's id.</returns>
    public static Task<Guid> EnsureHandoutAsync(
        MathCompsDbContext dbContext, string contentId, CancellationToken cancellationToken = default) =>
        EnsureAsync(
            dbContext.Handouts
                .Where(handout => handout.ContentId == contentId)
                .Select(handout => handout.Id),
            () => dbContext.Handouts
                .Upsert(new Handout { ContentId = contentId })
                .On(handout => handout.ContentId),
            cancellationToken);

    /// <summary>
    /// Resolves the anchor row for one environment inside a handout.
    /// </summary>
    /// <param name="dbContext">The operation's database context.</param>
    /// <param name="handoutId">The anchor row of the handout the environment belongs to.</param>
    /// <param name="contentId">The environment's permanent id, unique within its handout.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>The environment anchor row's id.</returns>
    public static Task<Guid> EnsureHandoutEnvironmentAsync(
        MathCompsDbContext dbContext, Guid handoutId, string contentId,
        CancellationToken cancellationToken = default) =>
        EnsureAsync(
            dbContext.HandoutEnvironments
                // An environment's id is only unique within its own handout, so both parts locate it.
                .Where(environment => environment.HandoutId == handoutId && environment.ContentId == contentId)
                .Select(environment => environment.Id),
            () => dbContext.HandoutEnvironments
                .Upsert(new HandoutEnvironment { HandoutId = handoutId, ContentId = contentId })
                .On(environment => new { environment.HandoutId, environment.ContentId }),
            cancellationToken);

    /// <summary>
    /// Resolves the anchor row for a file-based news article.
    /// </summary>
    /// <param name="dbContext">The operation's database context.</param>
    /// <param name="contentId">The article's permanent content id.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>The news article anchor row's id.</returns>
    public static Task<Guid> EnsureNewsArticleAsync(
        MathCompsDbContext dbContext, string contentId, CancellationToken cancellationToken = default) =>
        EnsureAsync(
            dbContext.NewsArticles
                .Where(newsArticle => newsArticle.ContentId == contentId)
                .Select(newsArticle => newsArticle.Id),
            () => dbContext.NewsArticles
                .Upsert(new NewsArticle { ContentId = contentId })
                .On(newsArticle => newsArticle.ContentId),
            cancellationToken);

    /// <summary>
    /// Resolves an anchor row, minting it only when nothing has ever been attached to that content before.
    /// </summary>
    /// <typeparam name="TEntity">The anchor entity's type.</typeparam>
    /// <param name="matchingIds">The ids of the rows already anchoring this content: one of them, or none.</param>
    /// <param name="buildUpsert">Builds the insert, matched on whatever makes the anchor unique.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>The anchor row's id.</returns>
    private static async Task<Guid> EnsureAsync<TEntity>(
        IQueryable<Guid> matchingIds, Func<UpsertCommandBuilder<TEntity>> buildUpsert,
        CancellationToken cancellationToken)
        where TEntity : class
    {
        // An anchor is minted once and read forever after, so the write is worth looking to avoid.
        var existingId = await matchingIds
            .Select(id => (Guid?)id)
            .FirstOrDefaultAsync(cancellationToken);

        // Nothing left to do once the row is already standing.
        if (existingId is not null)
            return existingId.Value;

        // First time anything has been attached to this content. A racing caller may have just inserted the
        // same row, so conflict means leave theirs alone rather than fail.
        await buildUpsert().NoUpdate().RunAsync(cancellationToken);

        // Read back whichever row ended up winning that race.
        return await matchingIds.FirstAsync(cancellationToken);
    }
}

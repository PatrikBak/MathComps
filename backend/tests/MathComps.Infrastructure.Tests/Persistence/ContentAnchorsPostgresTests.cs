using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;

namespace MathComps.Infrastructure.Tests.Persistence;

/// <summary>
/// Covers <see cref="ContentAnchors"/> against a real database: the rows standing in for content that lives
/// outside it are minted once and reused forever after, an environment's identity counts only within its own
/// handout, and callers racing to mint the same never-seen anchor all settle on one row.
/// </summary>
/// <param name="fixture">The shared PostgreSQL container fixture.</param>
public class ContentAnchorsPostgresTests(PostgresContainerFixture fixture)
    : PostgresTestBase<IDbContextFactory<MathCompsDbContext>>(fixture)
{
    /// <inheritdoc/>
    /// <remarks>The anchors under test are minted by the calls themselves, so there is nothing to seed.</remarks>
    protected override Task SeedDataAsync(MathCompsDbContext context) => Task.CompletedTask;

    /// <summary>
    /// The first call mints the handout's anchor row and every later one hands back that same row rather than a
    /// second one — the property every consumer relies on to attach comments and defenses to shared content.
    /// </summary>
    [Fact]
    public Task A_handout_anchor_is_minted_once_and_reused() => RunTestAsync(async factory =>
    {
        // Anchor a handout nothing has ever been attached to
        var minted = await EnsureHandoutAsync(factory, "handout-1");

        // Ask for it again, the way a second comment or defense would
        var reused = await EnsureHandoutAsync(factory, "handout-1");

        // Both calls named the same row
        Assert.Equal(minted, reused);

        // And only one was ever created
        await QueryAsync(async context => Assert.Equal(1, await context.Handouts.CountAsync()));
    });

    /// <summary>
    /// An environment's id is unique only within its handout, so the same id under a different handout is a
    /// different environment. Matching on the id alone would collapse the two and hand one handout's defenses to
    /// the other's problem.
    /// </summary>
    [Fact]
    public Task An_environment_id_is_scoped_to_its_own_handout() => RunTestAsync(async factory =>
    {
        // Two different handouts, each with an environment called "prob-1"
        var firstHandout = await EnsureHandoutAsync(factory, "handout-1");
        var secondHandout = await EnsureHandoutAsync(factory, "handout-2");

        // Anchor that same environment id under each
        var firstEnvironment = await EnsureEnvironmentAsync(factory, firstHandout, "prob-1");
        var secondEnvironment = await EnsureEnvironmentAsync(factory, secondHandout, "prob-1");

        // They are distinct environments despite the shared id
        Assert.NotEqual(firstEnvironment, secondEnvironment);

        // Re-anchoring under the first handout still lands on the first environment
        Assert.Equal(firstEnvironment, await EnsureEnvironmentAsync(factory, firstHandout, "prob-1"));

        // Two rows in all, one per handout
        await QueryAsync(async context => Assert.Equal(2, await context.HandoutEnvironments.CountAsync()));
    });

    /// <summary>
    /// A second environment under a handout already anchored reuses that handout's row: the lookup that skips the
    /// write on the common path must not also skip creating a genuinely new environment.
    /// </summary>
    [Fact]
    public Task A_second_environment_hangs_off_the_handout_already_anchored() => RunTestAsync(async factory =>
    {
        // One handout, two environments in it
        var handoutId = await EnsureHandoutAsync(factory, "handout-1");
        var first = await EnsureEnvironmentAsync(factory, handoutId, "prob-1");
        var second = await EnsureEnvironmentAsync(factory, handoutId, "prob-2");

        // Each environment got its own row
        Assert.NotEqual(first, second);

        // Both hang off the single handout anchor
        await QueryAsync(async context =>
        {
            // The handout was not duplicated
            Assert.Equal(1, await context.Handouts.CountAsync());

            // And both environments point at it
            Assert.Equal(2, await context.HandoutEnvironments.CountAsync(
                environment => environment.HandoutId == handoutId));
        });
    });

    /// <summary>
    /// Callers racing to anchor the same never-seen content all miss the initial lookup, so they all attempt the
    /// insert; exactly one may win and every one of them must still come away with that winner's id.
    /// </summary>
    [Fact]
    public Task Concurrent_mints_of_one_anchor_settle_on_a_single_row() => RunTestAsync(async factory =>
    {
        // Ten callers, each on its own connection, reaching for a handout none of them has seen
        var anchorIds = await Task.WhenAll(Enumerable.Range(0, 10)
            .Select(_ => EnsureHandoutAsync(factory, "contended-handout")));

        // Every caller came away naming the same row
        Assert.Single(anchorIds.Distinct());

        // Because only one was ever created
        await QueryAsync(async context => Assert.Equal(1, await context.Handouts.CountAsync()));
    });

    /// <summary>
    /// Resolves a handout anchor on a context of its own, the way a request-scoped caller would.
    /// </summary>
    /// <param name="factory">The factory minting the call's context.</param>
    /// <param name="contentId">The handout's permanent content id.</param>
    /// <returns>The handout anchor row's id.</returns>
    private static async Task<Guid> EnsureHandoutAsync(
        IDbContextFactory<MathCompsDbContext> factory, string contentId)
    {
        // A fresh context, since concurrent callers must not share one
        await using var context = await factory.CreateDbContextAsync();

        // The anchor for this handout
        return await ContentAnchors.EnsureHandoutAsync(context, contentId);
    }

    /// <summary>
    /// Resolves an environment anchor on a context of its own.
    /// </summary>
    /// <param name="factory">The factory minting the call's context.</param>
    /// <param name="handoutId">The anchor row of the handout the environment belongs to.</param>
    /// <param name="contentId">The environment's permanent id, unique within its handout.</param>
    /// <returns>The environment anchor row's id.</returns>
    private static async Task<Guid> EnsureEnvironmentAsync(
        IDbContextFactory<MathCompsDbContext> factory, Guid handoutId, string contentId)
    {
        // A fresh context, matching how the helper is called in production
        await using var context = await factory.CreateDbContextAsync();

        // The anchor for this environment
        return await ContentAnchors.EnsureHandoutEnvironmentAsync(context, handoutId, contentId);
    }
}

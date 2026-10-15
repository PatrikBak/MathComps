using MathComps.Domain.Contracts.Competitions;
using MathComps.Infrastructure.Extensions;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Selection;
using MathComps.Infrastructure.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace MathComps.Infrastructure.Tests.Selection;

/// <summary>
/// Covers <see cref="ProposalService"/>: what the reviewers record about a proposal, and the soft delete that
/// takes one out of the selection, stamping its row and emptying its slots.
/// </summary>
/// <param name="fixture">The shared PostgreSQL container fixture.</param>
public class ProposalServicePostgresTests(PostgresContainerFixture fixture)
    : PostgresTestBase<IProposalService>(fixture)
{
    /// <summary>
    /// A proposal in the pool, standing on a draft board and recommended for the advanced category.
    /// </summary>
    private Guid _pooledId;

    /// <summary>
    /// A proposal a paper has taken, sitting in a hosted round.
    /// </summary>
    private Guid _usedId;

    /// <summary>
    /// A reviewer rating the pooled proposal.
    /// </summary>
    private readonly Guid _raterId = Guid.CreateVersion7();

    /// <summary>
    /// Another reviewer rating the pooled proposal.
    /// </summary>
    private readonly Guid _otherRaterId = Guid.CreateVersion7();

    /// <inheritdoc/>
    protected override void ConfigureServices(IServiceCollection services) =>
        // The service under test, with the rest of the selection.
        services.AddProblemSelectionServices();

    /// <summary>
    /// A recommendation switches one category and leaves the rest standing, kept in the order the categories run
    /// whichever order they were switched on in. Each switch writes the whole list back, so a write built from the
    /// switched category alone would drop the rest, and one appending it would store them out of order.
    /// </summary>
    [Fact]
    public Task A_recommendation_switches_one_category_and_keeps_the_rest() => RunTestAsync(async service =>
    {
        // Elementary switched on beside the advanced one already there
        await service.SetRecommendedAsync(_pooledId, HostedCompetitionCategory.Elementary, isRecommended: true);

        // Both stand, easiest first
        Assert.Equal(
            [HostedCompetitionCategory.Elementary, HostedCompetitionCategory.Advanced],
            await RecommendedAsync());

        // Advanced switched off
        await service.SetRecommendedAsync(_pooledId, HostedCompetitionCategory.Advanced, isRecommended: false);

        // Leaving elementary alone
        Assert.Equal([HostedCompetitionCategory.Elementary], await RecommendedAsync());
    });

    /// <summary>
    /// A rating replaces what the reviewer gave before, both scores at once, and leaves every other reviewer's
    /// rating standing. A write that matched the proposal alone would overwrite the other reviewer's.
    /// </summary>
    [Fact]
    public Task A_rating_replaces_the_raters_own_and_leaves_the_rest() => RunTestAsync(async service =>
    {
        // The other reviewer's rating
        await service.RateAsync(_pooledId, _otherRaterId, beauty: 2, difficulty: 3);

        // The rater's first rating
        await service.RateAsync(_pooledId, _raterId, beauty: 4, difficulty: 1);

        // Replaced, the difficulty now left out
        await service.RateAsync(_pooledId, _raterId, beauty: 5, difficulty: null);

        // The rater's as replaced, the other reviewer's as given
        Assert.Equal([(_otherRaterId, 2, 3), (_raterId, 5, null)], await RatingsAsync());
    });

    /// <summary>
    /// Leaving out both scores takes the rating back, its row gone, since a row holding neither is one the database
    /// refuses.
    /// </summary>
    [Fact]
    public Task Leaving_out_both_scores_takes_the_rating_back() => RunTestAsync(async service =>
    {
        // Rated
        await service.RateAsync(_pooledId, _raterId, beauty: 3, difficulty: 4);

        // Taken back
        await service.RateAsync(_pooledId, _raterId, beauty: null, difficulty: null);

        // No rating left
        Assert.Empty(await RatingsAsync());
    });

    /// <summary>
    /// A score below one or past five is refused and writes nothing, whichever aspect it scores, while the ends of
    /// the scale are taken.
    /// </summary>
    [Fact]
    public Task A_score_off_the_scale_is_refused() => RunTestAsync(async service =>
    {
        // A beauty below the scale
        await Assert.ThrowsAsync<ProposalRatingValueException>(
            () => service.RateAsync(_pooledId, _raterId, beauty: 0, difficulty: 3));

        // A difficulty past the scale
        await Assert.ThrowsAsync<ProposalRatingValueException>(
            () => service.RateAsync(_pooledId, _raterId, beauty: 3, difficulty: 6));

        // Nothing written
        Assert.Empty(await RatingsAsync());

        // The ends of the scale
        await service.RateAsync(_pooledId, _raterId, beauty: 1, difficulty: 5);

        // The rating at the ends
        Assert.Equal([(_raterId, 1, 5)], await RatingsAsync());
    });

    /// <summary>
    /// A delete stamps the proposal, keeping its row, and empties the slot it stood in. A slot left behind would keep
    /// the deleted proposal on its paper while the selection no longer lists it.
    /// </summary>
    [Fact]
    public Task A_delete_stamps_the_proposal_and_empties_its_slots() => RunTestAsync(async service =>
    {
        // Deleted
        await service.DeleteAsync(_pooledId);

        // The pooled proposal's deletion stamp, its row still there
        var deletedAt = await QueryValueAsync(context => context.Proposals
            .Where(proposal => proposal.ProblemId == _pooledId)
            .Select(proposal => proposal.DeletedAt)
            .SingleAsync());

        // Stamped
        Assert.NotNull(deletedAt);

        // Off the board
        Assert.False(await QueryValueAsync(context =>
            context.SelectionSlots.AnyAsync(slot => slot.ProblemId == _pooledId)));
    });

    /// <summary>
    /// A problem a paper has taken stays in its round, so its proposal cannot be deleted. Stamped, it would vanish
    /// from the selection while a paper still holds it.
    /// </summary>
    [Fact]
    public Task A_used_proposal_cannot_be_deleted() => RunTestAsync(async service =>
        // Deleting the used proposal, refused
        await Assert.ThrowsAsync<SelectionProposalUsedException>(() => service.DeleteAsync(_usedId)));

    /// <summary>
    /// A deleted proposal is gone from the selection, so it can't be set aside or rated. A change slipping through
    /// would be recorded against a proposal the selection no longer shows.
    /// </summary>
    [Fact]
    public Task A_deleted_proposal_takes_no_change() => RunTestAsync(async service =>
    {
        // Deleted
        await service.DeleteAsync(_pooledId);

        // Setting the deleted proposal aside, refused
        await Assert.ThrowsAsync<SelectionTargetNotFoundException>(
            () => service.SetAsideAsync(_pooledId, isSetAside: true));

        // And rating it, refused too
        await Assert.ThrowsAsync<SelectionTargetNotFoundException>(
            () => service.RateAsync(_pooledId, _raterId, beauty: 3, difficulty: null));
    });

    /// <inheritdoc/>
    protected override async Task SeedDataAsync(MathCompsDbContext context)
    {
        // The season every round sits in
        var season = SelectionSeed.NewSeason(context);

        // The proposals round the pool is parked in
        var pool = SelectionSeed.NewProposalsRound(context, season);

        // The pooled proposal
        _pooledId = SelectionSeed.NewProposal(context, pool, 1, 1);

        // The pooled proposal recommended for advanced
        context.Proposals.Local.Single(proposal => proposal.ProblemId == _pooledId).Recommended =
            [HostedCompetitionCategory.Advanced];

        // An October group
        var october = SelectionSeed.NewGroup(context, season, "october", DateTimeOffset.UtcNow.AddDays(10));

        // The used proposal, in the October group's first round
        _usedId = SelectionSeed.NewProposal(context, october.Rounds.First(), 2, 1);

        // A draft board the pooled proposal stands on
        SelectionSeed.NewBoard(context, "Draft", _pooledId);

        // The reviewers rating the pooled proposal
        context.Users.AddRange(HostedSeed.NewUser(_raterId, "Rater"), HostedSeed.NewUser(_otherRaterId, "Other"));

        // Written
        await context.SaveChangesAsync();
    }

    /// <summary>
    /// Reads what the pooled proposal is recommended for.
    /// </summary>
    /// <returns>The categories.</returns>
    private Task<List<HostedCompetitionCategory>> RecommendedAsync() =>
        // The pooled proposal's recommendations
        QueryValueAsync(context => context.Proposals
            .Where(proposal => proposal.ProblemId == _pooledId)
            .Select(proposal => proposal.Recommended)
            .SingleAsync());

    /// <summary>
    /// Reads every rating of the pooled proposal, the other reviewer's first.
    /// </summary>
    /// <returns>Each rating's reviewer and scores.</returns>
    private async Task<List<(Guid, int?, int?)>> RatingsAsync()
    {
        // The pooled proposal's ratings, by the reviewers' usernames
        var ratings = await QueryValueAsync(context => context.ProposalRatings
            .Where(rating => rating.ProposalId == _pooledId)
            .OrderBy(rating => rating.User.Username)
            .Select(rating => new { rating.UserId, rating.Beauty, rating.Difficulty })
            .ToListAsync());

        // Each as its reviewer and scores
        return [.. ratings.Select(rating => (rating.UserId, rating.Beauty, rating.Difficulty))];
    }
}

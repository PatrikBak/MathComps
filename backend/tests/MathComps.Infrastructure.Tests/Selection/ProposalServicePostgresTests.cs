using MathComps.Domain.EfCoreEntities;
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
    /// A proposal in MathComps' pool, standing on a draft board and recommended for the advanced category.
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
    /// A recommendation switches one category and leaves the rest standing, and switching on one already there
    /// changes nothing. A write that replaced the proposal's categories with the one switched would drop the rest.
    /// </summary>
    [Fact]
    public Task A_recommendation_switches_one_category_and_keeps_the_rest() => RunTestAsync(async service =>
    {
        // Elementary switched on beside the advanced one already there
        await service.SetRecommendedAsync(Organization.MathCompsSlug, _pooledId, "elementary", isRecommended: true);

        // Both stand
        Assert.Equal(["elementary", "advanced"], await RecommendedAsync());

        // Advanced switched on again
        await service.SetRecommendedAsync(Organization.MathCompsSlug, _pooledId, "advanced", isRecommended: true);

        // Both still stand
        Assert.Equal(["elementary", "advanced"], await RecommendedAsync());

        // Advanced switched off
        await service.SetRecommendedAsync(Organization.MathCompsSlug, _pooledId, "advanced", isRecommended: false);

        // Leaving elementary alone
        Assert.Equal(["elementary"], await RecommendedAsync());
    });

    /// <summary>
    /// A proposal is recommended only for a category of its own organization. Another organization's category of
    /// the name given would otherwise land on it, and the selection would show a category outside the organization's
    /// own.
    /// </summary>
    [Fact]
    public Task A_category_of_another_organization_is_refused() => RunTestAsync(async service =>
    {
        // The olympiad's category, switched on for MathComps' proposal, refused
        await Assert.ThrowsAsync<SelectionTargetNotFoundException>(
            () => service.SetRecommendedAsync(Organization.MathCompsSlug, _pooledId, "C", isRecommended: true));

        // The proposal still recommended for advanced alone
        Assert.Equal(["advanced"], await RecommendedAsync());
    });

    /// <summary>
    /// A rating replaces what the reviewer gave before, both scores at once, and leaves every other reviewer's
    /// rating standing. A write that matched the proposal alone would overwrite the other reviewer's.
    /// </summary>
    [Fact]
    public Task A_rating_replaces_the_raters_own_and_leaves_the_rest() => RunTestAsync(async service =>
    {
        // The other reviewer's rating
        await service.RateAsync(Organization.MathCompsSlug, _pooledId, _otherRaterId, beauty: 2, difficulty: 3);

        // The rater's first rating
        await service.RateAsync(Organization.MathCompsSlug, _pooledId, _raterId, beauty: 4, difficulty: 1);

        // Replaced, the difficulty now left out
        await service.RateAsync(Organization.MathCompsSlug, _pooledId, _raterId, beauty: 5, difficulty: null);

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
        await service.RateAsync(Organization.MathCompsSlug, _pooledId, _raterId, beauty: 3, difficulty: 4);

        // Taken back
        await service.RateAsync(Organization.MathCompsSlug, _pooledId, _raterId, beauty: null, difficulty: null);

        // No rating left
        Assert.Empty(await RatingsAsync());
    });

    /// <summary>
    /// A score below one, past five or between two tenths is refused and writes nothing, whichever aspect it scores,
    /// while the ends of the scale and the tenths between them are taken and read back as given.
    /// </summary>
    [Fact]
    public Task A_score_off_the_scale_or_between_its_steps_is_refused() => RunTestAsync(async service =>
    {
        // A beauty below the scale
        await Assert.ThrowsAsync<ProposalRatingValueException>(
            () => service.RateAsync(Organization.MathCompsSlug, _pooledId, _raterId, beauty: 0, difficulty: 3));

        // A difficulty past the scale
        await Assert.ThrowsAsync<ProposalRatingValueException>(
            () => service.RateAsync(Organization.MathCompsSlug, _pooledId, _raterId, beauty: 3, difficulty: 6));

        // A difficulty a tenth past the scale
        await Assert.ThrowsAsync<ProposalRatingValueException>(
            () => service.RateAsync(Organization.MathCompsSlug, _pooledId, _raterId, beauty: 3, difficulty: 5.1m));

        // A beauty between two tenths
        await Assert.ThrowsAsync<ProposalRatingValueException>(
            () => service.RateAsync(Organization.MathCompsSlug, _pooledId, _raterId, beauty: 2.35m, difficulty: 3));

        // Nothing written
        Assert.Empty(await RatingsAsync());

        // The ends of the scale
        await service.RateAsync(Organization.MathCompsSlug, _pooledId, _raterId, beauty: 1, difficulty: 5);

        // The rating at the ends
        Assert.Equal([(_raterId, 1, 5)], await RatingsAsync());

        // Tenths
        await service.RateAsync(Organization.MathCompsSlug, _pooledId, _raterId, beauty: 3.7m, difficulty: 4.2m);

        // The rating on the tenths
        Assert.Equal([(_raterId, 3.7m, 4.2m)], await RatingsAsync());
    });

    /// <summary>
    /// A delete stamps the proposal, keeping its row, and empties the slot it stood in. A slot left behind would keep
    /// the deleted proposal on its paper while the selection no longer lists it.
    /// </summary>
    [Fact]
    public Task A_delete_stamps_the_proposal_and_empties_its_slots() => RunTestAsync(async service =>
    {
        // Deleted
        await service.DeleteAsync(Organization.MathCompsSlug, _pooledId);

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
        await Assert.ThrowsAsync<SelectionProposalUsedException>(
            () => service.DeleteAsync(Organization.MathCompsSlug, _usedId)));

    /// <summary>
    /// A deleted proposal is gone from the selection, so it can't be set aside or rated. A change slipping through
    /// would be recorded against a proposal the selection no longer shows.
    /// </summary>
    [Fact]
    public Task A_deleted_proposal_takes_no_change() => RunTestAsync(async service =>
    {
        // Deleted
        await service.DeleteAsync(Organization.MathCompsSlug, _pooledId);

        // Setting the deleted proposal aside, refused
        await Assert.ThrowsAsync<SelectionTargetNotFoundException>(
            () => service.SetAsideAsync(Organization.MathCompsSlug, _pooledId, isSetAside: true));

        // And rating it, refused too
        await Assert.ThrowsAsync<SelectionTargetNotFoundException>(
            () => service.RateAsync(Organization.MathCompsSlug, _pooledId, _raterId, beauty: 3, difficulty: null));
    });

    /// <summary>
    /// A proposal is reached through its own organization's selection alone, so a write naming another organization
    /// is refused like one naming no proposal, and changes nothing.
    /// </summary>
    [Fact]
    public Task A_change_through_another_organization_is_refused() => RunTestAsync(async service =>
    {
        // Setting the pooled proposal aside through the olympiad's selection, refused
        await Assert.ThrowsAsync<SelectionTargetNotFoundException>(
            () => service.SetAsideAsync("olympiad", _pooledId, isSetAside: true));

        // Deleting the pooled proposal through the olympiad's selection, refused too
        await Assert.ThrowsAsync<SelectionTargetNotFoundException>(() => service.DeleteAsync("olympiad", _pooledId));

        // The proposal as it stood
        var proposal = await QueryValueAsync(context => context.Proposals
            .Where(candidate => candidate.ProblemId == _pooledId)
            .Select(candidate => new { candidate.IsSetAside, candidate.DeletedAt })
            .SingleAsync());

        // Neither set aside nor deleted
        Assert.Equal((false, null), (proposal.IsSetAside, proposal.DeletedAt));
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
        SelectionSeed.Recommend(context, _pooledId, "advanced");

        // Another organization, listing a category of its own
        SelectionSeed.NewOrganization(context, "olympiad", "C");

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
    /// <returns>The categories' names, in the order the categories run.</returns>
    private Task<List<string>> RecommendedAsync() =>
        // The pooled proposal's recommendations
        QueryValueAsync(context => context.ProposalRecommendations
            .Where(recommendation => recommendation.ProposalId == _pooledId)
            .OrderBy(recommendation => recommendation.Category.Position)
            .Select(recommendation => recommendation.Category.Name)
            .ToListAsync());

    /// <summary>
    /// Reads every rating of the pooled proposal, the other reviewer's first.
    /// </summary>
    /// <returns>Each rating's reviewer and scores.</returns>
    private async Task<List<(Guid, decimal?, decimal?)>> RatingsAsync()
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

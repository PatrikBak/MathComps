using MathComps.Domain.Contracts.Competitions;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace MathComps.Infrastructure.Services.Selection;

/// <summary>
/// Implements <see cref="IProposalService"/> over the database, each change one write through
/// <see cref="SelectionRules.RunWriteAsync"/>.
/// </summary>
/// <param name="dbContextFactory">Creates the context each change runs on.</param>
public sealed class ProposalService(IDbContextFactory<MathCompsDbContext> dbContextFactory) : IProposalService
{
    /// <inheritdoc/>
    public Task SetAsideAsync(Guid proposalId, bool isSetAside, CancellationToken cancellationToken = default) =>
        // The change, as one selection write
        SelectionRules.RunWriteAsync(dbContextFactory, async dbContext =>
        {
            // The proposal
            var proposal = await SelectionRules.ReadProposalAsync(dbContext, proposalId, cancellationToken);

            // Set aside or back, as asked
            proposal.IsSetAside = isSetAside;
        }, cancellationToken);

    /// <inheritdoc/>
    public Task SetRecommendedAsync(
        Guid proposalId, HostedCompetitionCategory category, bool isRecommended,
        CancellationToken cancellationToken = default) =>
        // The change, as one selection write
        SelectionRules.RunWriteAsync(dbContextFactory, async dbContext =>
        {
            // The proposal
            var proposal = await SelectionRules.ReadProposalAsync(dbContext, proposalId, cancellationToken);

            // Every category recommended after the switch, in the order the categories run
            proposal.Recommended = SelectionRules.InCategoryOrder(isRecommended
                // The stored categories with this one added
                ? proposal.Recommended.Append(category)
                // The stored categories without this one
                : proposal.Recommended.Where(candidate => candidate != category));
        }, cancellationToken);

    /// <inheritdoc/>
    public async Task RateAsync(
        Guid proposalId, Guid raterId, decimal? beauty, decimal? difficulty,
        CancellationToken cancellationToken = default)
    {
        // A score off the scale or between its steps is no score the rating can hold
        if (!IsOnScale(beauty) || !IsOnScale(difficulty))
            throw new ProposalRatingValueException();

        // The rating, as one selection write
        await SelectionRules.RunWriteAsync(dbContextFactory, async dbContext =>
        {
            // A proposal gone from the selection takes no rating
            await SelectionRules.ReadProposalAsync(dbContext, proposalId, cancellationToken);

            // The rating the reviewer gave the proposal before, if any
            var rating = await dbContext.ProposalRatings.FindAsync([proposalId, raterId], cancellationToken);

            // Neither score given takes the rating back
            if (beauty is null && difficulty is null)
            {
                // Gone, where there was one
                if (rating is not null)
                    dbContext.ProposalRatings.Remove(rating);

                // Nothing more to write
                return;
            }

            // A first rating starts as a row of its own
            if (rating is null)
            {
                // The row, its scores set below
                rating = new ProposalRating { ProposalId = proposalId, UserId = raterId };

                // Saved with the write
                dbContext.ProposalRatings.Add(rating);
            }

            // The scores given now
            rating.Beauty = beauty;
            rating.Difficulty = difficulty;
        }, cancellationToken);
    }

    /// <inheritdoc/>
    public Task DeleteAsync(Guid proposalId, CancellationToken cancellationToken = default) =>
        // The delete, as one selection write
        SelectionRules.RunWriteAsync(dbContextFactory, async dbContext =>
        {
            // The proposal
            var proposal = await SelectionRules.ReadProposalAsync(dbContext, proposalId, cancellationToken);

            // A problem a paper has taken stays in its round, so its proposal stays with it
            if (!SelectionRules.IsInPool(proposal.Problem.Round.Competition.Path))
                throw new SelectionProposalUsedException();

            // The proposal gone from the selection and its discussion closed, its problem and conversations kept
            proposal.DeletedAt = DateTimeOffset.UtcNow;

            // And the proposal off every board it stood on
            await SelectionRules.RemoveSlotsAsync(dbContext, [proposal.ProblemId], cancellationToken);
        }, cancellationToken);

    /// <summary>
    /// Says whether a score is one a rating can hold: none at all, or one of the scale's steps.
    /// </summary>
    /// <param name="score">The score; null for none.</param>
    /// <returns>Whether the score is missing or on the scale.</returns>
    private static bool IsOnScale(decimal? score) =>
        // No score, or one within the scale that lands on a step
        score is null
        || (score is >= ProposalRating.MinScore and <= ProposalRating.MaxScore
            && score.Value * ProposalRating.StepsPerPoint % 1 == 0);
}

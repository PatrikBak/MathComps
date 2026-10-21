using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Organizations;
using Microsoft.EntityFrameworkCore;

namespace MathComps.Infrastructure.Services.Selection;

/// <summary>
/// Implements <see cref="IProposalService"/> over the database, each change one write through
/// <see cref="SelectionRules.RunWriteAsync"/>. The account's lead categories are read before the write waits its
/// turn, since no selection write changes them.
/// </summary>
/// <param name="dbContextFactory">Creates the context each change runs on.</param>
/// <param name="members">Reads which categories the account making a change leads.</param>
public sealed class ProposalService(
    IDbContextFactory<MathCompsDbContext> dbContextFactory,
    IOrganizationMemberService members)
    : IProposalService
{
    /// <inheritdoc/>
    public async Task SetAsideAsync(
        string organizationSlug, Guid userId, Guid proposalId, bool isSetAside,
        CancellationToken cancellationToken = default)
    {
        // Whether the account leads any of the organization's categories
        var isLead = (await members.GetLeadCategoryIdsAsync(userId, organizationSlug, cancellationToken)).Count > 0;

        // The change, as one selection write
        await SelectionRules.RunWriteAsync(dbContextFactory, async dbContext =>
        {
            // The proposal
            var proposal = await SelectionRules.ReadProposalAsync(
                dbContext, organizationSlug, proposalId, cancellationToken);

            // Only a lead sets a proposal aside or brings it back
            if (!isLead)
                throw new ProposalNotLeadException();

            // Set aside or back, as asked
            proposal.IsSetAside = isSetAside;
        }, cancellationToken);
    }

    /// <inheritdoc/>
    public async Task SetRecommendedAsync(
        string organizationSlug, Guid userId, Guid proposalId, string category, bool isRecommended,
        CancellationToken cancellationToken = default)
    {
        // Whether the account leads any of the organization's categories
        var isLead = (await members.GetLeadCategoryIdsAsync(userId, organizationSlug, cancellationToken)).Count > 0;

        // The change, as one selection write
        await SelectionRules.RunWriteAsync(dbContextFactory, async dbContext =>
        {
            // The proposal
            var proposal = await SelectionRules.ReadProposalAsync(
                dbContext, organizationSlug, proposalId, cancellationToken);

            // Only a lead recommends a proposal for a category, or takes it back
            if (!isLead)
                throw new ProposalNotLeadException();

            // The category, one of the proposal's organization's
            var categoryId = await dbContext.OrganizationCategories
                .Where(candidate => candidate.OrganizationId == proposal.OrganizationId && candidate.Name == category)
                .Select(candidate => (Guid?)candidate.Id)
                .FirstOrDefaultAsync(cancellationToken)
                ?? throw new SelectionTargetNotFoundException();

            // The recommendation as it stands, if the proposal has it
            var recommendation = await dbContext.ProposalRecommendations
                .FindAsync([proposalId, categoryId], cancellationToken);

            // A recommendation the proposal lacks, added
            if (isRecommended && recommendation is null)
                dbContext.ProposalRecommendations.Add(
                    new ProposalRecommendation { ProposalId = proposalId, CategoryId = categoryId });

            // A recommendation taken back, where the proposal has it
            if (!isRecommended && recommendation is not null)
                dbContext.ProposalRecommendations.Remove(recommendation);
        }, cancellationToken);
    }

    /// <inheritdoc/>
    public async Task RateAsync(
        string organizationSlug, Guid proposalId, Guid raterId, decimal? beauty, decimal? difficulty,
        CancellationToken cancellationToken = default)
    {
        // A score off the scale or between its steps is no score the rating can hold
        if (!IsOnScale(beauty) || !IsOnScale(difficulty))
            throw new ProposalRatingValueException();

        // The rating, as one selection write
        await SelectionRules.RunWriteAsync(dbContextFactory, async dbContext =>
        {
            // A proposal gone from the selection, or another organization's, takes no rating
            await SelectionRules.ReadProposalAsync(dbContext, organizationSlug, proposalId, cancellationToken);

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
    public async Task DeleteAsync(
        string organizationSlug, Guid userId, Guid proposalId, CancellationToken cancellationToken = default)
    {
        // Whether the account leads any of the organization's categories
        var isLead = (await members.GetLeadCategoryIdsAsync(userId, organizationSlug, cancellationToken)).Count > 0;

        // The delete, as one selection write
        await SelectionRules.RunWriteAsync(dbContextFactory, async dbContext =>
        {
            // The proposal
            var proposal = await SelectionRules.ReadProposalAsync(
                dbContext, organizationSlug, proposalId, cancellationToken);

            // Only a lead deletes a proposal
            if (!isLead)
                throw new ProposalNotLeadException();

            // A problem a paper has taken stays in its round, so its proposal stays with it
            if (!SelectionRules.IsInPool(proposal.Problem.Round.Competition.Path))
                throw new SelectionProposalUsedException();

            // The proposal gone from the selection and its discussion closed, its problem and conversations kept
            proposal.DeletedAt = DateTimeOffset.UtcNow;

            // And the proposal off every board it stood on
            await SelectionRules.RemoveSlotsAsync(dbContext, [proposal.ProblemId], cancellationToken);
        }, cancellationToken);
    }

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

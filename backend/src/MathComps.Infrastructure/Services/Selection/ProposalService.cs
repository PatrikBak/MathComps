using MathComps.Domain.Contracts.Competitions;
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
}

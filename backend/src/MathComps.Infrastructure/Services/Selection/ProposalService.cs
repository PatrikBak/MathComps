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
            proposal.Recommended =
            [
                .. Enum.GetValues<HostedCompetitionCategory>().Where(candidate =>
                    candidate == category ? isRecommended : proposal.Recommended.Contains(candidate)),
            ];
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

            // The proposal gone from the selection, its problem, conversations and comments kept
            proposal.DeletedAt = DateTimeOffset.UtcNow;

            // And the proposal off every board it stood on
            await SelectionRules.RemoveSlotsAsync(dbContext, [proposal.ProblemId], cancellationToken);
        }, cancellationToken);

    /// <inheritdoc/>
    public Task AddCommentAsync(
        Guid userId, Guid proposalId, string content, CancellationToken cancellationToken = default) =>
        // The comment, as one selection write
        SelectionRules.RunWriteAsync(dbContextFactory, async dbContext =>
        {
            // Only a live proposal takes a comment
            await SelectionRules.ReadProposalAsync(dbContext, proposalId, cancellationToken);

            // The comment
            var comment = new Comment
            {
                AuthorId = userId,
                Content = content,
                Status = CommentStatus.Active,
                CreatedAt = DateTimeOffset.UtcNow,
            };

            // The comment, saved with the write
            dbContext.Comments.Add(comment);

            // Hung off the proposal
            dbContext.ProposalComments.Add(new ProposalComment { ProposalId = proposalId, CommentId = comment.Id });
        }, cancellationToken);
}

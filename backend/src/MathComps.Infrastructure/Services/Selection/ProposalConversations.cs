using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.ConversationReview;
using MathComps.Infrastructure.Services.Users;
using Microsoft.EntityFrameworkCore;

namespace MathComps.Infrastructure.Services.Selection;

/// <summary>
/// Implements <see cref="IProposalConversations"/> over the database.
/// </summary>
/// <param name="dbContextFactory">Creates the context each check runs on.</param>
/// <param name="grants">Reads when a conversation's author started preparing the competitions.</param>
public sealed class ProposalConversations(
    IDbContextFactory<MathCompsDbContext> dbContextFactory,
    IUserGrantService grants)
    : IProposalConversations
{
    /// <inheritdoc/>
    public async Task EnsureConversationAsync(Guid sessionId, CancellationToken cancellationToken = default)
    {
        // A fresh context for this check.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // Refused unless the conversation is a reviewer's about a proposal the selection holds.
        await EnsureAsync(dbContext, sessionId, cancellationToken);
    }

    /// <inheritdoc/>
    public async Task EnsureNoteAsync(Guid noteId, CancellationToken cancellationToken = default)
    {
        // A fresh context for this check.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // The conversation the note stands on, where there is a note.
        var sessionId = await dbContext.AdminNotes
            .AsNoTracking()
            .Where(note => note.Id == noteId)
            .Select(note => (Guid?)note.SessionId)
            .FirstOrDefaultAsync(cancellationToken)
            ?? throw new ReviewNoteNotFoundException();

        // Refused unless that conversation is a reviewer's about a proposal the selection holds.
        await EnsureAsync(dbContext, sessionId, cancellationToken);
    }

    /// <inheritdoc cref="IProposalConversations.EnsureConversationAsync" path="/summary"/>
    /// <param name="dbContext">The check's context.</param>
    /// <param name="sessionId">The conversation.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <exception cref="SelectionTargetNotFoundException">
    /// Thrown when no conversation has the id, or it is not one the reviewers held about a proposal the selection
    /// still holds.
    /// </exception>
    private async Task EnsureAsync(MathCompsDbContext dbContext, Guid sessionId, CancellationToken cancellationToken)
    {
        // Who held the conversation and when it started, with where its problem sits, read only where a proposal
        // that has not been deleted files the problem.
        var conversation = await dbContext.ProblemDefenses
            .AsNoTracking()
            .Where(defense => defense.DefenseSessionId == sessionId)
            .Join(
                dbContext.Proposals.Where(proposal => proposal.DeletedAt == null),
                defense => defense.ProblemId,
                proposal => proposal.ProblemId,
                (defense, proposal) => new
                {
                    defense.DefenseSession.UserId,
                    defense.DefenseSession.CreatedAt,
                    CompetitionPath = proposal.Problem.Round.Competition.Path,
                    GroupOpensAt = (DateTimeOffset?)proposal.Problem.Round.HostedGroup!.OpensAt,
                })
            .FirstOrDefaultAsync(cancellationToken);

        // A conversation about anything but a proposal the selection still holds is no reviewer's.
        if (conversation is null
            || !SelectionRules.IsInSelection(
                conversation.CompetitionPath, conversation.GroupOpensAt, DateTimeOffset.UtcNow))
            throw new SelectionTargetNotFoundException();

        // When the conversation's author started preparing the competitions, if they still do.
        var preparerSince = await grants.GetGrantedAtAsync(
            conversation.UserId, UserCapability.PrepareCompetitions, cancellationToken);

        // Nor is a conversation whose author wasn't preparing the competitions when it started, or has since stopped.
        if (!SelectionRules.IsReviewersConversation(preparerSince, conversation.CreatedAt))
            throw new SelectionTargetNotFoundException();
    }
}

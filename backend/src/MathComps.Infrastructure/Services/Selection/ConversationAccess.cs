using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.ConversationReview;
using MathComps.Infrastructure.Services.Defense;
using MathComps.Infrastructure.Services.Organizations;
using Microsoft.EntityFrameworkCore;

namespace MathComps.Infrastructure.Services.Selection;

/// <summary>
/// Implements <see cref="IConversationAccess"/> over the database.
/// </summary>
/// <param name="dbContextFactory">Creates the context each check runs on.</param>
/// <param name="members">Reads who is on a proposal's organization's list.</param>
public sealed class ConversationAccess(
    IDbContextFactory<MathCompsDbContext> dbContextFactory,
    IOrganizationMemberService members)
    : IConversationAccess
{
    /// <inheritdoc/>
    public async Task EnsureConversationAsync(
        Guid sessionId, ConversationViewer viewer, CancellationToken cancellationToken = default)
    {
        // A fresh context for this check.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // Refused as though it were not there unless the viewer may reach the conversation.
        if (!await MayReachAsync(dbContext, sessionId, viewer, cancellationToken))
            throw new DefenseSessionNotFoundException();
    }

    /// <inheritdoc/>
    public async Task EnsureNoteAsync(
        Guid noteId, ConversationViewer viewer, CancellationToken cancellationToken = default)
    {
        // A fresh context for this check.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // The conversation the note stands on, where there is a note.
        var sessionId = await dbContext.AdminNotes
            .AsNoTracking()
            .Where(note => note.Id == noteId)
            .Select(note => (Guid?)note.SessionId)
            .FirstOrDefaultAsync(cancellationToken);

        // Refused as though it were not there unless there is a note and the viewer may reach its conversation.
        if (sessionId is not { } noteSessionId
            || !await MayReachAsync(dbContext, noteSessionId, viewer, cancellationToken))
            throw new ReviewNoteNotFoundException();
    }

    /// <summary>
    /// Whether a viewer may reach a conversation.
    /// </summary>
    /// <param name="dbContext">The check's context.</param>
    /// <param name="sessionId">The conversation.</param>
    /// <param name="viewer">Who is asking.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>Whether the viewer may reach it; true for an admin where no conversation has the id.</returns>
    private async Task<bool> MayReachAsync(
        MathCompsDbContext dbContext, Guid sessionId, ConversationViewer viewer, CancellationToken cancellationToken)
    {
        // The proposals still their organization's: outside the groups that have opened, deleted or not.
        var ownedProposals = dbContext.Proposals.WhereOutsideOpenedGroups(DateTimeOffset.UtcNow);

        // The proposal outside the groups that have opened filing the conversation's problem, where one does: its
        // organization and whether it is deleted.
        var proposal = await dbContext.DefenseSessions
            .AsNoTracking()
            .Where(session => session.Id == sessionId)
            .Select(session => ownedProposals
                .Where(candidate => candidate.ProblemId == session.ProblemTarget!.ProblemId)
                .Select(candidate => new
                {
                    OrganizationSlug = candidate.Organization.Slug,
                    IsDeleted = candidate.DeletedAt != null,
                })
                .FirstOrDefault())
            .FirstOrDefaultAsync(cancellationToken);

        // A conversation about anything but such a proposal belongs to no organization and reaches the admins alone,
        // as does an id naming no conversation.
        if (proposal is null)
            return viewer.IsAdmin;

        // Only the members of the proposal's organization reach it, admins included.
        if (!await members.IsMemberAsync(viewer.UserId, proposal.OrganizationSlug, cancellationToken))
            return false;

        // A deleted proposal is gone from the selection, so its conversations reach the admins among the members alone.
        return !proposal.IsDeleted || viewer.IsAdmin;
    }
}

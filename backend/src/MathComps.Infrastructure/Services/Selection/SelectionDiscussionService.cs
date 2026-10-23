using System.Collections.Immutable;
using MathComps.Domain.Contracts.Comments;
using MathComps.Domain.Contracts.Selection;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Comments;
using MathComps.Infrastructure.Services.Organizations;
using MathComps.Shared.Extensions;
using Microsoft.EntityFrameworkCore;

namespace MathComps.Infrastructure.Services.Selection;

/// <summary>
/// Implements <see cref="ISelectionDiscussionService"/> over the database, the discussions through
/// <see cref="ICommentService"/> and how far they are seen through <see cref="ICommentSeenService"/>.
/// </summary>
/// <param name="dbContextFactory">Creates the context each read runs on.</param>
/// <param name="comments">Reads the discussions of what the selection holds.</param>
/// <param name="seen">Keeps how far each reviewer has seen the discussions.</param>
/// <param name="members">Reads whether the reviewer is a member of the organization.</param>
public sealed class SelectionDiscussionService(
    IDbContextFactory<MathCompsDbContext> dbContextFactory,
    ICommentService comments,
    ICommentSeenService seen,
    IOrganizationMemberService members)
    : ISelectionDiscussionService
{
    /// <summary>
    /// Everything the selection holds, each as the id its discussion goes by.
    /// </summary>
    /// <param name="ProposalIds">The proposals the selection holds.</param>
    /// <param name="PaperIds">The papers on a board the selection holds.</param>
    private sealed record HeldSubjects(ImmutableList<string> ProposalIds, ImmutableList<string> PaperIds);

    /// <inheritdoc/>
    public async Task<SelectionDiscussionsDto> GetDiscussionsAsync(
        string organizationSlug, CommentViewer viewer, CancellationToken cancellationToken = default)
    {
        // Everything the selection holds
        var (proposalIds, paperIds) = await ReadHeldSubjectsAsync(organizationSlug, viewer, cancellationToken);

        // The proposals' discussions, by the proposal.
        var proposalThreads = comments.GetThreadsAsync(
            CommentTargetType.Proposal, proposalIds, viewer, cancellationToken);

        // The papers' discussions, by the paper.
        var paperThreads = comments.GetThreadsAsync(
            CommentTargetType.SelectionPaper, paperIds, viewer, cancellationToken);

        // Wait for both reads, started together since neither needs the other.
        await Task.WhenAll(proposalThreads, paperThreads);

        // Each kind's discussions, by what they hang off.
        return new SelectionDiscussionsDto(await proposalThreads, await paperThreads);
    }

    /// <inheritdoc/>
    public async Task<SelectionDiscussionsSeenDto> GetDiscussionsSeenAsync(
        string organizationSlug, CommentViewer viewer, CancellationToken cancellationToken = default)
    {
        // Everything the selection holds
        var (proposalIds, paperIds) = await ReadHeldSubjectsAsync(organizationSlug, viewer, cancellationToken);

        // How far the viewer has seen the proposals' discussions, by the proposal.
        var proposalsSeen = seen.GetSeenAsync(CommentTargetType.Proposal, proposalIds, viewer, cancellationToken);

        // How far the viewer has seen the papers' discussions, by the paper.
        var papersSeen = seen.GetSeenAsync(CommentTargetType.SelectionPaper, paperIds, viewer, cancellationToken);

        // Wait for both reads, started together since neither needs the other.
        await Task.WhenAll(proposalsSeen, papersSeen);

        // How far each kind's discussions are seen, by what they hang off.
        return new SelectionDiscussionsSeenDto(await proposalsSeen, await papersSeen);
    }

    /// <inheritdoc/>
    public async Task<DiscussionsMarkedDto> MarkDiscussionsSeenAsync(
        string organizationSlug,
        CommentViewer viewer,
        ImmutableDictionary<Guid, DateTimeOffset> proposalsSeenUpTo,
        ImmutableDictionary<Guid, DateTimeOffset> papersSeenUpTo,
        CancellationToken cancellationToken = default)
    {
        // Everything the selection holds
        var held = await ReadHeldSubjectsAsync(organizationSlug, viewer, cancellationToken);

        // The moment the marks are written at
        var now = DateTimeOffset.UtcNow;

        // The proposals named that the selection holds, each with the moment the mark carries for it
        var proposalsMarkedUpTo = MarkedUpTo(proposalsSeenUpTo, held.ProposalIds, now);

        // The papers named that the selection holds, each with the moment the mark carries for it
        var papersMarkedUpTo = MarkedUpTo(papersSeenUpTo, held.PaperIds, now);

        // The proposals marked.
        var proposalsMarked = seen.MarkSeenAsync(
            CommentTargetType.Proposal, proposalsMarkedUpTo, viewer, cancellationToken);

        // The papers marked.
        var papersMarked = seen.MarkSeenAsync(
            CommentTargetType.SelectionPaper, papersMarkedUpTo, viewer, cancellationToken);

        // Wait for both writes, started together since neither needs the other.
        await Task.WhenAll(proposalsMarked, papersMarked);

        // Each discussion marked, with the moment it is now seen at least up to
        return new DiscussionsMarkedDto(proposalsMarkedUpTo, papersMarkedUpTo);
    }

    /// <summary>
    /// Reads everything an organization's selection holds, as a viewer reaches it: every standing proposal of its
    /// pool that <see cref="SelectionRules.IsInSelection"/> keeps in it, and every paper on one of its boards that
    /// <see cref="SelectionRules.IsBoardInSelection"/> keeps in it, none of either for a viewer outside the
    /// organization.
    /// </summary>
    /// <param name="organizationSlug">
    /// The <see cref="Organization.Slug"/> of the organization whose selection it is.
    /// </param>
    /// <param name="viewer">The reviewer reaching it.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>The proposals and papers, each as the id its discussion goes by.</returns>
    private async Task<HeldSubjects> ReadHeldSubjectsAsync(
        string organizationSlug, CommentViewer viewer, CancellationToken cancellationToken)
    {
        // Nothing for a viewer outside the organization
        if (!await members.IsMemberAsync(viewer.UserId, organizationSlug, cancellationToken))
            return new HeldSubjects([], []);

        // A fresh context for this read.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // One instant for everything the read weighs against a group opening.
        var now = DateTimeOffset.UtcNow;

        // Every proposal of the organization's pool not deleted and outside the groups that have opened, with where
        // its problem sits.
        var proposals = await dbContext.Proposals
            .AsNoTracking()
            .Where(proposal => proposal.Organization.Slug == organizationSlug)
            .WhereSelectionMayHold(now)
            .Select(proposal => new
            {
                proposal.ProblemId,
                CompetitionPath = proposal.Problem.Round.Competition.Path,
                GroupOpensAt = (DateTimeOffset?)proposal.Problem.Round.HostedGroup!.OpensAt,
            })
            .ToListAsync(cancellationToken);

        // The proposals the selection still holds, each as the id its discussion goes by.
        var proposalIds = proposals
            .Where(proposal => SelectionRules.IsInSelection(proposal.CompetitionPath, proposal.GroupOpensAt, now))
            .Select(proposal => proposal.ProblemId.ToString())
            .ToImmutableList();

        // Every paper on one of the organization's boards, with when the group its board was finalized into opens.
        var papers = await dbContext.SelectionPapers
            .AsNoTracking()
            .Where(paper => paper.Board.Organization.Slug == organizationSlug)
            .Select(paper => new { paper.Id, GroupOpensAt = (DateTimeOffset?)paper.Board.HostedGroup!.OpensAt })
            .ToListAsync(cancellationToken);

        // The papers on a board the selection still holds, each as the id its discussion goes by.
        var paperIds = papers
            .Where(paper => SelectionRules.IsBoardInSelection(paper.GroupOpensAt, now))
            .Select(paper => paper.Id.ToString())
            .ToImmutableList();

        // Both, each as the ids their discussions go by
        return new HeldSubjects(proposalIds, paperIds);
    }

    /// <summary>
    /// The moments a mark carries for some discussions of one kind: those of subjects the selection holds, each held
    /// to now since nothing yet to be posted has been seen, as precise as the database keeps it so a mark this writes
    /// reads back as the moment handed back.
    /// </summary>
    /// <param name="seenUpTo">The moment each discussion was seen up to, by its subject's id.</param>
    /// <param name="heldIds">
    /// The subjects of the kind the selection holds, each as the id its discussion goes by.
    /// </param>
    /// <param name="now">The moment the marks are written at.</param>
    /// <returns>
    /// Each discussion the selection holds, by the id it goes by, with the moment the mark carries for it.
    /// </returns>
    private static ImmutableDictionary<string, DateTimeOffset> MarkedUpTo(
        ImmutableDictionary<Guid, DateTimeOffset> seenUpTo, ImmutableList<string> heldIds, DateTimeOffset now)
    {
        // Each discussion named that the selection holds, its moment held to now and cut to the database's precision
        return seenUpTo
            .Where(entry => heldIds.Contains(entry.Key.ToString()))
            .ToImmutableDictionary(
                entry => entry.Key.ToString(),
                entry => (entry.Value < now ? entry.Value : now).ToUniversalTime().TruncateToMicroseconds());
    }
}

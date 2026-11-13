using MathComps.Domain.Contracts.Defense;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Competitions;
using MathComps.Infrastructure.Services.Organizations;
using MathComps.Infrastructure.Services.Selection;
using Microsoft.EntityFrameworkCore;

namespace MathComps.Infrastructure.Services.Defense;

/// <summary>
/// The database-backed <see cref="IDefenseTargetGuard"/>. A handout environment is open to anybody signed in, so
/// the only arm with anything to check is a problem: where its round sits, whether the site hosts it, and whether
/// the student holds an entry into it are read in one go, and a round still under embargo is the one that turns
/// that entry into the permission. Whether the student is competing is a read of its own, apart from the permission.
/// </summary>
/// <param name="dbContextFactory">Creates the contexts the checks run on.</param>
/// <param name="members">
/// Reads whether the student reviews a proposal's pool, and whether they prepare the competitions.
/// </param>
public sealed class DefenseTargetGuard(
    IDbContextFactory<MathCompsDbContext> dbContextFactory, IOrganizationMemberService members)
    : IDefenseTargetGuard
{
    /// <inheritdoc/>
    public Task EnsureCanDefendAsync(
        Guid userId, DefenseTarget target, CancellationToken cancellationToken = default) => target switch
        {
            // A published handout is open to every signed-in reader, so there is nothing to weigh.
            HandoutEnvironmentTarget => Task.CompletedTask,

            // A problem may be embargoed, and may not be one anybody is allowed to argue at all.
            ProblemTarget problem => EnsureCanDefendProblemAsync(userId, problem.ProblemId, cancellationToken),

            // A target nothing here knows, which is a bug rather than a bad request.
            _ => throw new ArgumentOutOfRangeException(nameof(target), target, "Unknown defense target."),
        };

    /// <inheritdoc/>
    public Task<bool> IsCompetingAsync(
        Guid userId, DefenseTarget target, CancellationToken cancellationToken = default) => target switch
        {
            // A handout is set in no round anybody enters.
            HandoutEnvironmentTarget => Task.FromResult(false),

            // A problem, by the student's clock in the round it is set in.
            ProblemTarget problem => IsCompetingOnProblemAsync(userId, problem.ProblemId, cancellationToken),

            // A target nothing here knows, which is a bug rather than a bad request.
            _ => throw new ArgumentOutOfRangeException(nameof(target), target, "Unknown defense target."),
        };

    /// <summary>
    /// Throws unless the student may argue one problem. A problem of a competition the site runs and a problem
    /// parked among the proposals are let through by different rules.
    /// </summary>
    /// <param name="userId">The student asking.</param>
    /// <param name="problemId">The problem they want to argue.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    private async Task EnsureCanDefendProblemAsync(
        Guid userId, Guid problemId, CancellationToken cancellationToken)
    {
        // A fresh context for this check.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // The sets the projection below reads. Held as their own values so the expression tree captures a set
        // rather than the context around it, which the analyzer reads as disposed by the time the tree runs.
        var allEntries = dbContext.HostedEntries;
        var allProposals = dbContext.Proposals;

        // The round the problem sits in: where in the taxonomy it hangs, the window its group runs in, whether
        // the site hosts it at all, whether this student has spent an entry into it, and the organization whose pool
        // a live proposal files the problem in. An id naming nothing gets the answer an unarguable problem gets.
        var round = await dbContext.Problems
            .AsNoTracking()
            .Where(problem => problem.Id == problemId)
            .Select(problem => new
            {
                CompetitionPath = problem.Round.Competition.Path,
                IsHosted = problem.Round.HostedGroupId != null,
                problem.Round.VisibleSince,
                problem.Round.HostedGroup!.ClosesAt,
                HoldsEntry = allEntries.Any(entry =>
                    entry.UserId == userId && entry.RoundId == problem.RoundId),
                ProposalOrganizationSlug = allProposals
                    .Where(proposal => proposal.ProblemId == problem.Id && proposal.DeletedAt == null)
                    .Select(proposal => proposal.Organization.Slug)
                    .FirstOrDefault(),
            })
            .FirstOrDefaultAsync(cancellationToken)
            ?? throw new HostedProblemNotFoundException();

        // Whether the problem sits among the proposals.
        var isProposal = SelectionRules.IsInPool(round.CompetitionPath);

        // Anything outside the proposals is arguable only where the site hosts its round.
        if (!isProposal && !round.IsHosted)
            throw new HostedProblemNotFoundException();

        // A problem among the proposals is for the reviewers of the pool a live proposal files it in
        if (isProposal)
        {
            // A caller off the list of the proposal's organization, and any problem parked among the proposals with no
            // live proposal, gets the answer an unarguable problem gets
            if (round.ProposalOrganizationSlug is not { } organizationSlug
                || !await members.IsMemberAsync(userId, organizationSlug, cancellationToken))
                throw new HostedProblemNotFoundException();

            // A reviewer of the pool is cleared, the hosted rules below having nothing to say about a proposal
            return;
        }

        // Whether the student prepares the competitions, which opens the gates to them.
        var preparesCompetitions = await members.IsMemberAsync(userId, Organization.MathCompsSlug, cancellationToken);

        // And past that it is the same rule the area serves its problems under.
        HostedEntryRules.EnsureEntitled(
            new HostedReader(userId, preparesCompetitions),
            new RoundAccess(round.VisibleSince, round.ClosesAt, round.HoldsEntry),
            DateTimeOffset.UtcNow);
    }

    /// <summary>
    /// Says whether the student is competing on one problem right now, by their clock in the round it is set in.
    /// </summary>
    /// <param name="userId">The student.</param>
    /// <param name="problemId">The problem they argue.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>Whether they are competing; false where no group hosts the problem's round.</returns>
    private async Task<bool> IsCompetingOnProblemAsync(
        Guid userId, Guid problemId, CancellationToken cancellationToken)
    {
        // A fresh context for this read.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // The set the projection below reads. Held as its own value so the expression tree captures a set rather
        // than the context around it, which the analyzer reads as disposed by the time the tree runs.
        var allEntries = dbContext.HostedEntries;

        // The close and the clock of the group hosting the problem's round, with when this student's clock in that
        // round ran. A problem no group hosts, or an id naming nothing, finds none.
        var round = await dbContext.Problems
            .AsNoTracking()
            .Where(problem => problem.Id == problemId && problem.Round.HostedGroupId != null)
            .Select(problem => new
            {
                problem.Round.HostedGroup!.ClosesAt,
                problem.Round.HostedGroup.ClockMinutes,
                Entry = allEntries
                    .Where(entry => entry.UserId == userId && entry.RoundId == problem.RoundId)
                    .Select(entry => new { entry.StartedAt, entry.FinishedAt })
                    .FirstOrDefault(),
            })
            .FirstOrDefaultAsync(cancellationToken);

        // Competing only in a hosted round, while the student's clock in it runs.
        return round is not null
            && HostedEntryRules.IsCompeting(
                round.ClosesAt, round.Entry?.StartedAt, round.Entry?.FinishedAt, round.ClockMinutes,
                DateTimeOffset.UtcNow);
    }
}

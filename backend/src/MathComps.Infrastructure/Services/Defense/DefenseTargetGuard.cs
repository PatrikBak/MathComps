using MathComps.Domain.Contracts.Defense;
using MathComps.Domain.EfCoreEntities;
using MathComps.Domain.Taxonomy;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Competitions;
using MathComps.Infrastructure.Services.Users;
using Microsoft.EntityFrameworkCore;

namespace MathComps.Infrastructure.Services.Defense;

/// <summary>
/// The database-backed <see cref="IDefenseTargetGuard"/>. A handout environment is open to anybody signed in, so
/// the only arm with anything to check is a problem: where its round sits, whether the site hosts it, and whether
/// the student holds an entry into it are read in one go, and a round still under embargo is the one that turns
/// that entry into the permission as well.
/// </summary>
/// <param name="dbContextFactory">Creates the contexts the checks run on.</param>
/// <param name="grants">Reads whether the student is let past the gates a competition is entered through.</param>
public sealed class DefenseTargetGuard(
    IDbContextFactory<MathCompsDbContext> dbContextFactory, IUserGrantService grants)
    : IDefenseTargetGuard
{
    /// <inheritdoc/>
    public Task<bool> EnsureCanDefendAsync(
        Guid userId, DefenseTarget target, CancellationToken cancellationToken = default) => target switch
        {
            // A published handout is open to every signed-in reader, so there is nothing to weigh and no entry
            // to hold.
            HandoutEnvironmentTarget => Task.FromResult(false),

            // A problem may be embargoed, and may not be one anybody is allowed to argue at all.
            ProblemTarget problem => EnsureCanDefendProblemAsync(userId, problem.ProblemId, cancellationToken),

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
    /// <returns>Whether the student has spent an entry into the problem's round.</returns>
    private async Task<bool> EnsureCanDefendProblemAsync(
        Guid userId, Guid problemId, CancellationToken cancellationToken)
    {
        // A fresh context for this check.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // The set the projection below reads. Held as its own value so the expression tree captures a set rather
        // than the context around it, which the analyzer reads as disposed by the time the tree runs.
        var allEntries = dbContext.HostedEntries;

        // The round the problem sits in: where in the taxonomy it hangs, the window its group runs in, whether
        // the site hosts it at all, and whether this student has spent an entry into it. The entry is read
        // whatever the embargo says, since it decides the daily spend ceiling as well as the permission, and a
        // group's problems go public the moment it closes. An id naming nothing gets the answer an unarguable
        // problem gets.
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
            })
            .FirstOrDefaultAsync(cancellationToken)
            ?? throw new HostedProblemNotFoundException();

        // A proposal belongs to no competition anybody enters, so nothing weighs it beyond the student being
        // signed in, and no entry stands to lift what it costs them.
        if (TaxonomySlugs.IsAtOrUnder(round.CompetitionPath, HostedTaxonomy.ProposalsPath))
            return false;

        // Anything else is arguable only where the site hosts its round.
        if (!round.IsHosted)
            throw new HostedProblemNotFoundException();

        // Whether the student is let past the gates this competition is entered through.
        var bypassesGates = await grants.HasAsync(
            userId, UserCapability.BypassCompetitionGates, cancellationToken);

        // And past that it is the same rule the area serves its problems under.
        HostedEntryRules.EnsureEntitled(
            new HostedReader(userId, bypassesGates),
            new RoundAccess(round.VisibleSince, round.ClosesAt, round.HoldsEntry),
            DateTimeOffset.UtcNow);

        // Cleared, and the entry says whether the daily spend ceiling reaches this defense.
        return round.HoldsEntry;
    }
}

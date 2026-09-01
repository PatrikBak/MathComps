using MathComps.Domain.Contracts.Defense;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Competitions;
using Microsoft.EntityFrameworkCore;

namespace MathComps.Infrastructure.Services.Defense;

/// <summary>
/// The database-backed <see cref="IDefenseTargetGuard"/>. A handout environment is open to anybody signed in, so
/// the only arm with anything to check is a problem: whether the site hosts its round and whether the student
/// holds an entry into it are read in one go, and a round still under embargo is the one that turns that entry
/// into the permission as well.
/// </summary>
/// <param name="dbContextFactory">Creates the contexts the checks run on.</param>
public sealed class DefenseTargetGuard(IDbContextFactory<MathCompsDbContext> dbContextFactory)
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
    /// Throws unless the student may argue one problem.
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

        // The round the problem sits in, whether the site hosts it at all, and whether this student has spent an
        // entry into it. The entry is read whatever the embargo says, since it decides the daily spend ceiling
        // as well as the permission, and a group's problems go public the moment it closes.
        var round = await dbContext.Problems
            .AsNoTracking()
            .Where(problem => problem.Id == problemId)
            .Select(problem => new
            {
                problem.RoundId,
                IsHosted = problem.Round.HostedGroupId != null,
                problem.Round.VisibleSince,
                HoldsEntry = allEntries.Any(entry =>
                    entry.UserId == userId && entry.RoundId == problem.RoundId),
            })
            .FirstOrDefaultAsync(cancellationToken);

        // Only a problem the site hosts may be argued, and one that does not exist reads the same.
        if (round is null || !round.IsHosted)
            throw new HostedProblemNotFoundException();

        // And past that it is the same rule the area serves its problems under.
        await HostedEntryRules.EnsureEntitledAsync(
            dbContext, userId, round.RoundId, round.VisibleSince, cancellationToken);

        // Cleared, and the entry says whether the daily spend ceiling reaches this defense.
        return round.HoldsEntry;
    }
}

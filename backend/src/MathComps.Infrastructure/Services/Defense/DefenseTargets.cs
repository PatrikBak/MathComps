using System.Linq.Expressions;
using MathComps.Domain.Contracts.Defense;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Persistence;

namespace MathComps.Infrastructure.Services.Defense;

/// <summary>
/// How a defense target maps to storage: which kind a session is stamped with, which row says what it defends,
/// how a stored session's target is read back, and how the sessions held against one target are selected.
/// </summary>
internal static class DefenseTargets
{
    /// <summary>
    /// Reads which kind of thing a target names, which is what a session is stamped with.
    /// </summary>
    /// <param name="target">The target being defended.</param>
    /// <returns>Its kind.</returns>
    public static DefenseTargetKind KindOf(DefenseTarget target) => target switch
    {
        HandoutEnvironmentTarget => DefenseTargetKind.Handout,
        ProblemTarget => DefenseTargetKind.Problem,
        _ => throw new ArgumentOutOfRangeException(nameof(target), target, "Unknown defense target."),
    };

    /// <summary>
    /// Builds the filter selecting the sessions held against one target.
    /// </summary>
    /// <param name="target">The target the sessions defend.</param>
    /// <returns>The predicate, over the sessions of whichever kind the target is.</returns>
    public static Expression<Func<DefenseSession, bool>> HeldAgainst(DefenseTarget target) => target switch
    {
        // Both content ids identify the environment, the second only within the first.
        HandoutEnvironmentTarget handout => session =>
            session.EnvironmentTarget != null
            && session.EnvironmentTarget.HandoutEnvironment.ContentId == handout.EnvironmentId
            && session.EnvironmentTarget.HandoutEnvironment.Handout.ContentId == handout.HandoutContentId,

        // One id identifies the problem outright.
        ProblemTarget problem => session =>
            session.ProblemTarget != null && session.ProblemTarget.ProblemId == problem.ProblemId,

        // A target nothing here knows, which is a bug rather than a bad request.
        _ => throw new ArgumentOutOfRangeException(nameof(target), target, "Unknown defense target."),
    };

    /// <summary>
    /// Rebuilds the target of a stored session from the two arms' columns, of which the session's kind says
    /// which one is filled.
    /// </summary>
    /// <remarks>
    /// The columns of the arm the kind names are non-null by the database's own rules, which
    /// <see cref="DefenseTargetKind"/> lays out.
    /// </remarks>
    /// <param name="kind">Which arm the session was stamped with.</param>
    /// <param name="handoutContentId">The handout's content id, null on a session defending a problem.</param>
    /// <param name="environmentId">The environment's content id, null on a session defending a problem.</param>
    /// <param name="problemId">The problem's id, null on a handout session.</param>
    /// <returns>The target the session defends.</returns>
    public static DefenseTarget FromColumns(
        DefenseTargetKind kind, string? handoutContentId, string? environmentId, Guid? problemId) => kind switch
        {
            // Both content ids, the second only meaningful within the first.
            DefenseTargetKind.Handout => new HandoutEnvironmentTarget(handoutContentId!, environmentId!),

            // One id identifies the problem outright.
            DefenseTargetKind.Problem => new ProblemTarget(problemId!.Value),

            // A target kind nothing here knows, which is a bug rather than a bad request.
            _ => throw new ArgumentOutOfRangeException(nameof(kind), kind, "Unknown defense target kind."),
        };

    /// <summary>
    /// Stages the row saying what a new session defends: one row of the table its target's kind hangs off.
    /// </summary>
    /// <param name="dbContext">The operation's database context.</param>
    /// <param name="sessionId">The session being anchored.</param>
    /// <param name="target">What it defends.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    public static async Task AddRowAsync(
        MathCompsDbContext dbContext, Guid sessionId, DefenseTarget target, CancellationToken cancellationToken)
    {
        // Each arm writes a row of its own table, which is what makes the two exclusive.
        switch (target)
        {
            // A handout environment has anchor rows of its own, created the first time it is defended.
            case HandoutEnvironmentTarget handout:
                var handoutEnvironmentId =
                    await UpsertHandoutEnvironmentAsync(dbContext, handout, cancellationToken);

                // The link row, hanging the session off that anchor.
                dbContext.HandoutEnvironmentDefenses.Add(new HandoutEnvironmentDefense
                {
                    DefenseSessionId = sessionId,
                    HandoutEnvironmentId = handoutEnvironmentId,
                });
                break;

            // A problem is already a row of the archive, so the link is all there is to write.
            case ProblemTarget problem:
                dbContext.ProblemDefenses.Add(new ProblemDefense
                {
                    DefenseSessionId = sessionId,
                    ProblemId = problem.ProblemId,
                });
                break;

            // A target nothing here knows, which is a bug rather than a bad request.
            default:
                throw new ArgumentOutOfRangeException(nameof(target), target, "Unknown defense target.");
        }
    }

    /// <summary>
    /// Stages the handout and environment anchor rows a defense against a handout hangs off, reusing whichever
    /// already exist.
    /// </summary>
    /// <param name="dbContext">The operation's database context.</param>
    /// <param name="target">The environment being defended.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>The environment row's id.</returns>
    private static async Task<Guid> UpsertHandoutEnvironmentAsync(
        MathCompsDbContext dbContext, HandoutEnvironmentTarget target, CancellationToken cancellationToken)
    {
        // The handout the environment hangs off.
        var handoutId = await ContentAnchors.EnsureHandoutAsync(
            dbContext, target.HandoutContentId, cancellationToken);

        // The environment itself, scoped to that handout.
        return await ContentAnchors.EnsureHandoutEnvironmentAsync(
            dbContext, handoutId, target.EnvironmentId, cancellationToken);
    }
}

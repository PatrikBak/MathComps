using System.Linq.Expressions;
using MathComps.Domain.Contracts.Admin;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Competitions;
using MathComps.Infrastructure.Services.Users;
using Microsoft.EntityFrameworkCore;

namespace MathComps.Infrastructure.Services.Admin;

/// <summary>
/// What grading reads about hosted entries: which entry a student's grade on a problem belongs to, when that
/// entry's conversations count, and where grades stand.
/// </summary>
internal static class HostedGrading
{
    /// <summary>
    /// Finds the entry one student's grade on one problem belongs to, if anybody grades them on it.
    /// </summary>
    /// <param name="dbContext">The operation's database context.</param>
    /// <param name="grants">Reads whether a student is let past the gates a competition is entered through.</param>
    /// <param name="problemId">The problem.</param>
    /// <param name="userId">The student.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>The entry and the window its conversations count in, or null when nobody grades them on it.</returns>
    public static async Task<GradedEntry?> FindGradedEntryAsync(
        MathCompsDbContext dbContext,
        IUserGrantService grants,
        Guid problemId,
        Guid userId,
        CancellationToken cancellationToken)
    {
        // Every entry.
        var entries = dbContext.HostedEntries;

        // The problem's group and the student's entry into its round if they spent one. A problem outside every
        // hosted round is not one anybody grades.
        var lookup = await dbContext.Problems
            .AsNoTracking()
            .Where(problem => problem.Id == problemId && problem.Round.HostedGroupId != null)
            .Select(problem => new
            {
                problem.Round.HostedGroup!.ClosesAt,
                problem.Round.HostedGroup.ClockMinutes,
                Entry = entries
                    .Where(candidate => candidate.UserId == userId && candidate.RoundId == problem.RoundId)
                    .Select(candidate => new { candidate.Id, candidate.StartedAt, candidate.FinishedAt })
                    .FirstOrDefault(),
            })
            .FirstOrDefaultAsync(cancellationToken);

        // No such problem in any hosted round, or no entry into it, leaves nothing to grade.
        if (lookup?.Entry is not { } entry)
            return null;

        // Whether the site lets the student past its gates.
        var bypassesGates = await grants.HasAsync(userId, UserCapability.BypassCompetitionGates, cancellationToken);

        // The entry and when its conversations count, where anybody grades it.
        return GradedEntry.Of(
            entry.Id, entry.StartedAt, entry.FinishedAt, lookup.ClosesAt, lookup.ClockMinutes, bypassesGates);
    }

    /// <summary>
    /// Reads where one entry's grade on one problem stands.
    /// </summary>
    /// <param name="dbContext">The operation's database context.</param>
    /// <param name="entryId">The entry.</param>
    /// <param name="problemId">The problem.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>The grade, or null while nobody has given one.</returns>
    public static async Task<GradeDto?> ReadCurrentGradeAsync(
        MathCompsDbContext dbContext, Guid entryId, Guid problemId, CancellationToken cancellationToken)
    {
        // The newest version of this one grade.
        var grades = await ReadCurrentGradesAsync(
            dbContext, grade => grade.EntryId == entryId && grade.ProblemId == problemId, cancellationToken);

        // The grade, if there is one.
        return grades.SingleOrDefault()?.Grade;
    }

    /// <summary>
    /// Reads where grades stand.
    /// </summary>
    /// <param name="dbContext">The operation's database context.</param>
    /// <param name="scope">Which versions to read among.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>Each grade in scope with the entry and the problem it is for.</returns>
    public static Task<List<CurrentGrade>> ReadCurrentGradesAsync(
        MathCompsDbContext dbContext,
        Expression<Func<HostedGrade, bool>> scope,
        CancellationToken cancellationToken)
    {
        // Every version of every grade.
        var versions = dbContext.HostedGrades;

        // The versions in scope that nothing newer replaces, each with its author as the byline.
        return versions
            .AsNoTracking()
            .Where(scope)
            .Where(grade => !versions.Any(newer =>
                newer.EntryId == grade.EntryId
                && newer.ProblemId == grade.ProblemId
                && newer.CreatedAt > grade.CreatedAt))
            .Select(grade => new CurrentGrade(
                grade.EntryId,
                grade.ProblemId,
                new GradeDto(
                    grade.Mark,
                    grade.Help,
                    grade.InternalComment,
                    grade.IsFinal,
                    grade.CreatedAt,
                    new UserIdentityDto(
                        grade.Author.Id, grade.Author.IsDeleted ? null : grade.Author.Username, grade.Author.Email))))
            .ToListAsync(cancellationToken);
    }

    /// <summary>
    /// A grade where it stands, with the entry and the problem it is for.
    /// </summary>
    /// <param name="EntryId"><inheritdoc cref="HostedGrade.EntryId" path="/summary"/></param>
    /// <param name="ProblemId"><inheritdoc cref="HostedGrade.ProblemId" path="/summary"/></param>
    /// <param name="Grade">The grade.</param>
    public sealed record CurrentGrade(Guid EntryId, Guid ProblemId, GradeDto Grade);

    /// <summary>
    /// An entry that is graded, with the window its conversations count in.
    /// </summary>
    /// <param name="Id">The entry.</param>
    /// <param name="Window">When the entry's conversations count.</param>
    public sealed record GradedEntry(Guid Id, EntryWindow Window)
    {
        /// <summary>
        /// One entry as it is graded: an entry the student sat, in a run somebody grades.
        /// </summary>
        /// <param name="entryId">The entry.</param>
        /// <param name="startedAt"><inheritdoc cref="HostedEntry.StartedAt" path="/summary"/></param>
        /// <param name="finishedAt"><inheritdoc cref="HostedEntry.FinishedAt" path="/summary"/></param>
        /// <param name="closesAt"><inheritdoc cref="HostedGroup.ClosesAt" path="/summary"/></param>
        /// <param name="clockMinutes"><inheritdoc cref="HostedGroup.ClockMinutes" path="/summary"/></param>
        /// <param name="bypassesGates">
        /// <inheritdoc cref="HostedEntryRules.IsGraded" path="/param[@name='bypassesGates']"/></param>
        /// <returns>The entry and its window; null when nobody grades it.</returns>
        public static GradedEntry? Of(
            Guid entryId,
            DateTimeOffset? startedAt,
            DateTimeOffset? finishedAt,
            DateTimeOffset? closesAt,
            int clockMinutes,
            bool bypassesGates) =>
            // Graded only when the student sat the entry and somebody grades the run.
            startedAt is { } clockStartedAt && HostedEntryRules.IsGraded(closesAt, bypassesGates)
                ? new GradedEntry(
                    entryId,
                    new EntryWindow(clockStartedAt, HostedEntryRules.EndedAt(clockStartedAt, finishedAt, clockMinutes)))
                : null;
    }

    /// <summary>
    /// When a sat entry counted: from its clock starting to it stopping.
    /// </summary>
    /// <param name="StartedAt"><inheritdoc cref="HostedEntryRules.EndedAt" path="/param[@name='startedAt']"/></param>
    /// <param name="EndedAt"><inheritdoc cref="HostedEntryRules.EndedAt" path="/summary"/></param>
    public sealed record EntryWindow(DateTimeOffset StartedAt, DateTimeOffset EndedAt)
    {
        /// <summary>
        /// Whether a conversation started at an instant is one the entry counts.
        /// </summary>
        /// <param name="startedAt">When the conversation started.</param>
        /// <returns>Whether it started inside the window.</returns>
        public bool Holds(DateTimeOffset startedAt) => startedAt >= StartedAt && startedAt < EndedAt;
    }
}

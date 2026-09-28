using System.Linq.Expressions;
using MathComps.Domain.Contracts.Admin;
using MathComps.Domain.Contracts.Defense;
using MathComps.Domain.EfCoreEntities;
using MathComps.Domain.Taxonomy;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Competitions;
using MathComps.Infrastructure.Services.Users;
using MathComps.Shared.Extensions;
using Microsoft.EntityFrameworkCore;

namespace MathComps.Infrastructure.Services.Admin;

/// <summary>
/// Implements <see cref="IAdminGradingService"/> over the database.
/// </summary>
/// <param name="dbContextFactory">The factory minting each operation's database context.</param>
/// <param name="grants">Reads whether a student is let past the gates a competition is entered through.</param>
public class AdminGradingService(
    IDbContextFactory<MathCompsDbContext> dbContextFactory,
    IUserGrantService grants) : IAdminGradingService
{
    /// <summary>
    /// A grade nobody has touched: no mark, no help, nothing written, nothing settled.
    /// </summary>
    private static readonly GradeState _blank = new(null, 0, string.Empty, false);

    /// <inheritdoc/>
    public async Task<IReadOnlyList<GradingCompetitionDto>> GetBoardAsync(
        string groupSlug, CancellationToken cancellationToken = default)
    {
        // This read's own context, since reading a board is a unit of work in itself.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // The group with its rounds and their problems in order, if it is one that grades anybody.
        var group = await dbContext.HostedGroups
            .AsNoTracking()
            .Where(candidate => candidate.Slug == groupSlug && candidate.ClosesAt != null)
            .Select(candidate => new
            {
                candidate.Id,
                candidate.ClosesAt,
                candidate.ClockMinutes,
                Rounds = candidate.Rounds
                    .OrderBy(round => round.Competition.SortPath)
                    .Select(round => new
                    {
                        round.Id,
                        CompetitionPath = round.Competition.Path,
                        Problems = round.Problems
                            .OrderBy(problem => problem.Number)
                            .Select(problem => new GradingProblemDto(problem.Id, problem.Slug, problem.Number))
                            .ToList(),
                    })
                    .ToList(),
            })
            .FirstOrDefaultAsync(cancellationToken)
            ?? throw new HostedGroupNotFoundException();

        // Every entry into the group's rounds, by username, and by account among those with none.
        var entries = await dbContext.HostedEntries
            .AsNoTracking()
            .Where(entry => entry.Round.HostedGroupId == group.Id)
            .OrderBy(entry => entry.User.IsDeleted ? null : entry.User.Username)
            .ThenBy(entry => entry.UserId)
            .Select(entry => new
            {
                entry.Id,
                entry.RoundId,
                entry.StartedAt,
                entry.FinishedAt,
                User = new UserIdentityDto(
                    entry.User.Id, entry.User.IsDeleted ? null : entry.User.Username, entry.User.Email),
            })
            .ToListAsync(cancellationToken);

        // The entrants the site lets past its gates.
        var bypassing = await grants.GetHoldersAsync(
            [.. entries.Select(entry => entry.User.Id)], UserCapability.BypassCompetitionGates, cancellationToken);

        // Only the graded entries, each with the window its conversations count in.
        var graded = entries
            .Where(entry => entry.StartedAt is not null
                && HostedEntryRules.IsGraded(group.ClosesAt, bypassing.Contains(entry.User.Id)))
            .Select(entry => new
            {
                entry.Id,
                entry.RoundId,
                entry.User,
                Window = EntryWindow.Of(entry.StartedAt!.Value, entry.FinishedAt, group.ClockMinutes),
            })
            .ToList();

        // Which round each problem sits in.
        var roundOfProblem = group.Rounds
            .SelectMany(round => round.Problems.Select(problem => (ProblemId: problem.Id, RoundId: round.Id)))
            .ToDictionary(placement => placement.ProblemId, placement => placement.RoundId);

        // The graded students.
        var gradedUserIds = graded.Select(entry => entry.User.Id).ToList();

        // When every conversation a graded student held about the group's problems started, and who held it.
        var conversations = await dbContext.ProblemDefenses
            .AsNoTracking()
            .Where(defense => roundOfProblem.Keys.Contains(defense.ProblemId)
                && gradedUserIds.Contains(defense.DefenseSession.UserId))
            .Select(defense => new
            {
                defense.DefenseSession.UserId,
                defense.ProblemId,
                defense.DefenseSession.CreatedAt,
            })
            .ToListAsync(cancellationToken);

        // Each graded entry's window, by student and round.
        var windows = graded.ToDictionary(entry => (entry.User.Id, entry.RoundId), entry => entry.Window);

        // The conversations counted per student and problem, only those inside the student's window.
        var conversationCounts = conversations
            .Where(conversation =>
                windows.TryGetValue((conversation.UserId, roundOfProblem[conversation.ProblemId]), out var window)
                && window.Holds(conversation.CreatedAt))
            .CountBy(conversation => (conversation.UserId, conversation.ProblemId))
            .ToDictionary(count => count.Key, count => count.Value);

        // The graded entries' ids.
        var entryIds = graded.Select(entry => entry.Id).ToList();

        // Where the graded entries' grades stand, by entry and problem.
        var grades = (await ReadCurrentGradesAsync(
                dbContext, grade => entryIds.Contains(grade.EntryId), cancellationToken))
            .ToDictionary(current => (current.EntryId, current.ProblemId), current => current.Grade);

        // The board, one competition per round.
        return
        [
            .. group.Rounds.Select(round =>
            {
                // The round's graded entries, by username.
                var roundEntries = graded.Where(entry => entry.RoundId == round.Id).ToList();

                // The competition.
                return new GradingCompetitionDto(
                    round.Id,
                    // A group that closes runs its rounds at the levels, so a round outside them is not one this
                    // site set up.
                    HostedTaxonomy.CategoryOf(round.CompetitionPath)
                        ?? throw new InvalidOperationException($"Round {round.Id} of a graded group has no level."),
                    round.Problems,
                    // The round's graded entrants.
                    [.. roundEntries.Select(entry => entry.User)],
                    // Every graded entrant on every problem.
                    [
                        .. roundEntries.SelectMany(entry => round.Problems.Select(problem => new GradeSummaryDto(
                            entry.User.Id,
                            problem.Id,
                            conversationCounts.GetValueOrDefault((entry.User.Id, problem.Id)),
                            grades.GetValueOrDefault((entry.Id, problem.Id))))),
                    ]);
            }),
        ];
    }

    /// <inheritdoc/>
    public async Task<GradeDetailDto> GetGradeAsync(
        Guid problemId, Guid userId, CancellationToken cancellationToken = default)
    {
        // This read's own context.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // The entry the grade belongs to.
        var entry = await ResolveEntryAsync(dbContext, problemId, userId, cancellationToken);

        // Every conversation the student held about the problem, oldest first, each whole.
        var conversations = await dbContext.ProblemDefenses
            .AsNoTracking()
            .Where(defense => defense.ProblemId == problemId && defense.DefenseSession.UserId == userId)
            .OrderBy(defense => defense.DefenseSession.CreatedAt)
            .ThenBy(defense => defense.DefenseSessionId)
            .Select(defense => new GradingConversationDto(
                defense.DefenseSession.Id,
                defense.DefenseSession.CreatedAt,
                defense.DefenseSession.ProblemStatement,
                defense.DefenseSession.ProblemReference,
                defense.DefenseSession.Turns
                    .OrderBy(turn => turn.Sequence)
                    .Select(turn => new DefenseTurnDto(turn.Id, turn.Role, turn.Content, turn.CreatedAt))
                    .ToList()))
            .ToListAsync(cancellationToken);

        // What the student said about their own solution, if anything.
        var selfAssessment = await dbContext.ProblemSelfAssessments
            .AsNoTracking()
            .Where(assessment => assessment.UserId == userId && assessment.ProblemId == problemId)
            .Select(assessment => new SelfAssessmentDto(assessment.Comment, assessment.UpdatedAt))
            .FirstOrDefaultAsync(cancellationToken);

        // Where the grade stands.
        var grade = await ReadCurrentGradeAsync(dbContext, entry.Id, problemId, cancellationToken);

        // The grade with everything it is read from.
        return new GradeDetailDto(
            // Only the conversations inside the entry's window. Filtered here rather than in the query, so the board
            // and this read weigh the window by one rule.
            [.. conversations.Where(conversation => entry.Window.Holds(conversation.CreatedAt))],
            selfAssessment,
            grade);
    }

    /// <inheritdoc/>
    public async Task<GradeDto?> UpdateGradeAsync(
        Guid graderId,
        Guid problemId,
        Guid userId,
        UpdateGradeRequest change,
        CancellationToken cancellationToken = default)
    {
        // This write's own context.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // The entry the grade belongs to.
        var entry = await ResolveEntryAsync(dbContext, problemId, userId, cancellationToken);

        // One transaction for the read and the write, so the lock below spans both.
        await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);

        // Lock the entry, so changes to its grades land one after another. Without it, two changes sent together
        // would each read the grade before the other's write and the later row would drop the earlier change.
        await dbContext.Database.ExecuteSqlAsync(
            $"SELECT 1 FROM hosted_entries WHERE id = {entry.Id} FOR UPDATE", cancellationToken);

        // Where the grade stands now that nobody else can move it.
        var current = await ReadCurrentGradeAsync(dbContext, entry.Id, problemId, cancellationToken);

        // The standing grade in the shape a change applies to, blank where nobody has graded yet.
        var before = current is null
            ? _blank
            : new GradeState(current.Mark, current.Help, current.InternalComment, current.IsFinal);

        // What the change leaves.
        var after = Apply(before, change);

        // Nothing moved, so there is nothing to record. The transaction rolls back on its way out, having only read.
        if (after == before)
            return current;

        // The present, to the microsecond the database keeps.
        var now = DateTimeOffset.UtcNow.TruncateToMicroseconds();

        // When the version is written: now, unless the clock is not past the version it builds on, in which case
        // just past that one, since the newest stamp is what makes a version the grade.
        var createdAt = current is not null && current.UpdatedAt >= now ? current.UpdatedAt.AddMicroseconds(1) : now;

        // The new version.
        dbContext.HostedGrades.Add(new HostedGrade
        {
            EntryId = entry.Id,
            ProblemId = problemId,
            Mark = after.Mark,
            Help = after.Help,
            InternalComment = after.InternalComment,
            IsFinal = after.IsFinal,
            AuthorId = graderId,
            CreatedAt = createdAt,
        });

        // Write the version.
        await dbContext.SaveChangesAsync(cancellationToken);

        // Land the version and release the entry to the next change.
        await transaction.CommitAsync(cancellationToken);

        // Hand back the grade as the board reads it, byline included.
        return await ReadCurrentGradeAsync(dbContext, entry.Id, problemId, cancellationToken);
    }

    /// <summary>
    /// Finds the entry one student's grade on one problem belongs to, refusing unless it is graded.
    /// </summary>
    /// <param name="dbContext">The operation's database context.</param>
    /// <param name="problemId">The problem.</param>
    /// <param name="userId">The student.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>The entry and the window its conversations count in.</returns>
    private async Task<GradedEntry> ResolveEntryAsync(
        MathCompsDbContext dbContext, Guid problemId, Guid userId, CancellationToken cancellationToken)
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
            .FirstOrDefaultAsync(cancellationToken)
            ?? throw new HostedGradeTargetException();

        // Whether the site lets the student past its gates.
        var bypassesGates = await grants.HasAsync(userId, UserCapability.BypassCompetitionGates, cancellationToken);

        // No entry, or one nobody grades, leaves nothing to grade.
        if (lookup.Entry is not { StartedAt: { } startedAt } entry
            || !HostedEntryRules.IsGraded(lookup.ClosesAt, bypassesGates))
            throw new HostedGradeTargetException();

        // The entry, and when its conversations count.
        return new GradedEntry(entry.Id, EntryWindow.Of(startedAt, entry.FinishedAt, lookup.ClockMinutes));
    }

    /// <summary>
    /// Reads where one entry's grade on one problem stands.
    /// </summary>
    /// <param name="dbContext">The operation's database context.</param>
    /// <param name="entryId">The entry.</param>
    /// <param name="problemId">The problem.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>The grade, or null while nobody has given one.</returns>
    private static async Task<GradeDto?> ReadCurrentGradeAsync(
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
    private static Task<List<CurrentGrade>> ReadCurrentGradesAsync(
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
    /// Applies a change to a grade, refusing what it would leave if that breaks the grade's rules.
    /// </summary>
    /// <param name="grade">The grade as it stands.</param>
    /// <param name="change">What changed.</param>
    /// <returns>The grade the change leaves.</returns>
    private static GradeState Apply(GradeState grade, UpdateGradeRequest change)
    {
        // The mark the change sets or takes back, or the one standing.
        var mark = change.Mark is { } markChange ? markChange.Value : grade.Mark;

        // The help the change sets, or the standing one kept within the mark.
        var help = change.Help ?? Math.Min(grade.Help, mark ?? 0);

        // Whether the grade is settled: only while there is a mark to settle, unless the change says otherwise.
        var isFinal = change.IsFinal ?? (grade.IsFinal && mark is not null);

        // The comment the change writes, or the standing one.
        var internalComment = change.InternalComment ?? grade.InternalComment;

        // A mark below nothing or past the ceiling is refused.
        if (mark is < 0 or > HostedGrade.MaxMark)
            throw new HostedGradeValueException();

        // Help outside nothing to the whole mark is refused.
        if (help < 0 || help > (mark ?? 0))
            throw new HostedGradeValueException();

        // A grade settled with no mark is refused.
        if (isFinal && mark is null)
            throw new HostedGradeValueException();

        // What the grade becomes.
        return new GradeState(mark, help, internalComment, isFinal);
    }

    /// <summary>
    /// What one grade holds, apart from who wrote it and when: what a change is applied to and compared by.
    /// </summary>
    /// <param name="Mark"><inheritdoc cref="HostedGrade.Mark" path="/summary"/></param>
    /// <param name="Help"><inheritdoc cref="HostedGrade.Help" path="/summary"/></param>
    /// <param name="InternalComment"><inheritdoc cref="HostedGrade.InternalComment" path="/summary"/></param>
    /// <param name="IsFinal"><inheritdoc cref="HostedGrade.IsFinal" path="/summary"/></param>
    private sealed record GradeState(int? Mark, int Help, string InternalComment, bool IsFinal);

    /// <summary>
    /// A grade where it stands, with the entry and the problem it is for.
    /// </summary>
    /// <param name="EntryId"><inheritdoc cref="HostedGrade.EntryId" path="/summary"/></param>
    /// <param name="ProblemId"><inheritdoc cref="HostedGrade.ProblemId" path="/summary"/></param>
    /// <param name="Grade">The grade.</param>
    private sealed record CurrentGrade(Guid EntryId, Guid ProblemId, GradeDto Grade);

    /// <summary>
    /// An entry that is graded, with the window its conversations count in.
    /// </summary>
    /// <param name="Id">The entry.</param>
    /// <param name="Window">When the entry's conversations count.</param>
    private sealed record GradedEntry(Guid Id, EntryWindow Window);

    /// <summary>
    /// When a sat entry counted: from its clock starting to it stopping.
    /// </summary>
    /// <param name="StartedAt">When the entry's clock started.</param>
    /// <param name="EndedAt"><inheritdoc cref="HostedEntryRules.EndedAt" path="/summary"/></param>
    private sealed record EntryWindow(DateTimeOffset StartedAt, DateTimeOffset EndedAt)
    {
        /// <summary>
        /// The window of one sat entry.
        /// </summary>
        /// <param name="startedAt">When the entry's clock started.</param>
        /// <param name="finishedAt"><inheritdoc cref="HostedEntry.FinishedAt" path="/summary"/></param>
        /// <param name="clockMinutes"><inheritdoc cref="HostedGroup.ClockMinutes" path="/summary"/></param>
        /// <returns>The window.</returns>
        public static EntryWindow Of(DateTimeOffset startedAt, DateTimeOffset? finishedAt, int clockMinutes) =>
            new(startedAt, HostedEntryRules.EndedAt(startedAt, finishedAt, clockMinutes));

        /// <summary>
        /// Whether a conversation started at an instant is one the entry counts.
        /// </summary>
        /// <param name="startedAt">When the conversation started.</param>
        /// <returns>Whether it started inside the window.</returns>
        public bool Holds(DateTimeOffset startedAt) => startedAt >= StartedAt && startedAt < EndedAt;
    }
}

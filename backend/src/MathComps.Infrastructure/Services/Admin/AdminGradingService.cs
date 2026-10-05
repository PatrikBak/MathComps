using MathComps.Domain.Contracts.Admin;
using MathComps.Domain.EfCoreEntities;
using MathComps.Domain.Taxonomy;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Competitions;
using MathComps.Infrastructure.Services.Localization;
using MathComps.Infrastructure.Services.Users;
using MathComps.Shared.Extensions;
using Microsoft.EntityFrameworkCore;

namespace MathComps.Infrastructure.Services.Admin;

/// <summary>
/// Implements <see cref="IAdminGradingService"/> over the database.
/// </summary>
/// <param name="dbContextFactory">The factory minting each operation's database context.</param>
/// <param name="localization">The names the taxonomy gives the nodes a group's rounds run under.</param>
/// <param name="grants">Reads whether a student is let past the gates a competition is entered through.</param>
public class AdminGradingService(
    IDbContextFactory<MathCompsDbContext> dbContextFactory,
    IMetadataLocalizationService localization,
    IUserGrantService grants) : IAdminGradingService
{
    /// <summary>
    /// A grade nobody has touched: no mark, no help, nothing written, nothing settled.
    /// </summary>
    private static readonly GradeState _blank = new(null, 0, string.Empty, false);

    /// <inheritdoc/>
    public async Task<GradingBoardDto> GetBoardAsync(
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
                candidate.OpensAt,
                // Set on every group that grades anybody, which is the only kind the filter lets through.
                ClosesAt = candidate.ClosesAt!.Value,
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

        // Where every entry anybody grades stands on each problem of its round, and how far into its clock its
        // student last wrote about each.
        var gradings = await HostedGrading.ReadProblemGradingsAsync(
            dbContext,
            grants,
            [
                .. entries.Select(entry => new HostedGrading.SpentEntry(
                    entry.Id,
                    entry.User.Id,
                    entry.RoundId,
                    entry.StartedAt,
                    entry.FinishedAt,
                    group.ClosesAt,
                    group.ClockMinutes)),
            ],
            cancellationToken);

        // The graded entries with a counted conversation about any problem of their round, by username.
        var spoken = entries.Where(entry => gradings.HasSpoken(entry.Id)).ToList();

        // Their grades, everything the graders wrote included.
        var grades = await HostedGrading.ReadCurrentGradesAsync(
            dbContext, [.. spoken.Select(entry => entry.Id)], cancellationToken);

        // The board: which group it is, then one competition per round.
        return new GradingBoardDto(
            HostedGroupName.Of(localization, group.Rounds.FirstOrDefault()?.CompetitionPath),
            group.OpensAt,
            group.ClosesAt,
            [
                .. group.Rounds.Select(round =>
                {
                    // The round's entries among them.
                    var roundEntries = spoken.Where(entry => entry.RoundId == round.Id).ToList();

                    // The competition.
                    return new GradingCompetitionDto(
                        round.Id,
                        // A group that closes runs its rounds at the levels, so a round outside them is not one
                        // this site set up.
                        HostedTaxonomy.CategoryOf(round.CompetitionPath)
                            ?? throw new InvalidOperationException(
                                $"Round {round.Id} of a graded group has no level."),
                        round.Problems,
                        // The round's entrants who spoke while their entry counted, each with how far into their
                        // clock they last wrote about each problem, summed.
                        [
                            .. roundEntries.Select(entry =>
                                new GradingEntrantDto(entry.User, gradings.FinishedAfter(entry.Id).TotalSeconds)),
                        ],
                        // Every entrant who spoke, on every problem: their conversations about it and the grade.
                        [
                            .. roundEntries.SelectMany(entry => round.Problems.Select(problem => new GradeSummaryDto(
                                entry.User.Id,
                                problem.Id,
                                gradings.Of(entry.Id, problem.Id).Conversations,
                                grades.GetValueOrDefault((entry.Id, problem.Id))))),
                        ]);
                }),
            ]);
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

        // The entry the grade belongs to, refused where there is nothing to grade.
        var entry = await HostedGrading.FindGradableEntryAsync(
                dbContext, grants, problemId, userId, cancellationToken)
            ?? throw new HostedGradeTargetException();

        // One transaction for the read and the write, so the lock below spans both.
        await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);

        // Lock the entry, so changes to its grades land one after another. Without it, two changes sent together
        // would each read the grade before the other's write and the later row would drop the earlier change.
        await dbContext.Database.ExecuteSqlAsync(
            $"SELECT 1 FROM hosted_entries WHERE id = {entry.Id} FOR UPDATE", cancellationToken);

        // Where the grade stands now that nobody else can move it.
        var current = await HostedGrading.ReadCurrentGradeAsync(dbContext, entry.Id, problemId, cancellationToken);

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
            CreatedAt = NextVersionAt(current, now),
        });

        // Write the version.
        await dbContext.SaveChangesAsync(cancellationToken);

        // Land the version and release the entry to the next change.
        await transaction.CommitAsync(cancellationToken);

        // Hand back the grade as the board reads it, byline included.
        return await HostedGrading.ReadCurrentGradeAsync(dbContext, entry.Id, problemId, cancellationToken);
    }

    /// <inheritdoc/>
    public async Task<IReadOnlyList<StudentGradeDto>> FinalizeGradesAsync(
        Guid graderId,
        Guid problemId,
        IReadOnlyCollection<Guid> userIds,
        CancellationToken cancellationToken = default)
    {
        // This write's own context.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // The listed students' entries into the round the problem belongs to, each with its student.
        var studentByEntry = await dbContext.HostedEntries
            .AsNoTracking()
            .Where(entry => userIds.Contains(entry.UserId)
                && entry.Round.Problems.Any(problem => problem.Id == problemId))
            .Select(entry => new { entry.Id, entry.UserId })
            .ToDictionaryAsync(entry => entry.Id, entry => entry.UserId, cancellationToken);

        // Nobody listed entered the round, so nobody holds a grade on the problem.
        if (studentByEntry.Count == 0)
            return [];

        // The entries in the order they are locked in, which two writes locking several of them then share.
        Guid[] entryIds = [.. studentByEntry.Keys.Order()];

        // One transaction for the read and the write, so the lock below spans both.
        await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);

        // Lock the entries, as a change to one of their grades does, so such a change lands wholly before or after.
        await dbContext.Database.ExecuteSqlAsync(
            $"SELECT 1 FROM hosted_entries WHERE id = ANY({entryIds}) ORDER BY id FOR UPDATE", cancellationToken);

        // Where their grades stand now that nobody else can move them.
        var current = await HostedGrading.ReadCurrentGradesAsync(dbContext, entryIds, cancellationToken);

        // The present, to the microsecond the database keeps.
        var now = DateTimeOffset.UtcNow.TruncateToMicroseconds();

        // A final version of every grade on the problem that carries a mark and is not final yet, otherwise as it
        // stands.
        dbContext.HostedGrades.AddRange(current
            .Where(grade => grade.Key.ProblemId == problemId && grade.Value is { Mark: not null, IsFinal: false })
            .Select(grade => new HostedGrade
            {
                EntryId = grade.Key.EntryId,
                ProblemId = problemId,
                Mark = grade.Value.Mark,
                Help = grade.Value.Help,
                InternalComment = grade.Value.InternalComment,
                IsFinal = true,
                AuthorId = graderId,
                CreatedAt = NextVersionAt(grade.Value, now),
            }));

        // Write the versions.
        await dbContext.SaveChangesAsync(cancellationToken);

        // Land them and release the entries.
        await transaction.CommitAsync(cancellationToken);

        // Where the entries' grades stand now.
        var after = await HostedGrading.ReadCurrentGradesAsync(dbContext, entryIds, cancellationToken);

        // Those on the problem, each named by its student.
        return
        [
            .. after
                .Where(grade => grade.Key.ProblemId == problemId)
                .Select(grade => new StudentGradeDto(studentByEntry[grade.Key.EntryId], grade.Value)),
        ];
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
    /// Works out when a new version of a grade is written: now, unless the clock is not past the version it builds
    /// on, in which case just past that one, since the newest stamp is what makes a version the grade.
    /// </summary>
    /// <param name="current">The grade the version builds on, or null where nobody has graded yet.</param>
    /// <param name="now">The present, to the microsecond the database keeps.</param>
    /// <returns>When the version is written.</returns>
    private static DateTimeOffset NextVersionAt(GradeDto? current, DateTimeOffset now) =>
        // Now, or just past the version it builds on where the clock is not past that
        current is not null && current.UpdatedAt >= now ? current.UpdatedAt.AddMicroseconds(1) : now;

    /// <summary>
    /// What one grade holds, apart from who wrote it and when: what a change is applied to and compared by.
    /// </summary>
    /// <param name="Mark"><inheritdoc cref="HostedGrade.Mark" path="/summary"/></param>
    /// <param name="Help"><inheritdoc cref="HostedGrade.Help" path="/summary"/></param>
    /// <param name="InternalComment"><inheritdoc cref="HostedGrade.InternalComment" path="/summary"/></param>
    /// <param name="IsFinal"><inheritdoc cref="HostedGrade.IsFinal" path="/summary"/></param>
    private sealed record GradeState(int? Mark, int Help, string InternalComment, bool IsFinal);
}

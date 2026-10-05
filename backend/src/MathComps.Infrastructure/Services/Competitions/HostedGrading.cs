using System.Linq.Expressions;
using MathComps.Domain.Contracts.Admin;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Users;
using Microsoft.EntityFrameworkCore;

namespace MathComps.Infrastructure.Services.Competitions;

/// <summary>
/// What grading reads about hosted entries: which entry a student's grade on a problem belongs to, when that
/// entry's conversations count, where grades stand, how far into their clock students last wrote about each
/// problem, and what the conversation about a grade is called.
/// </summary>
internal static class HostedGrading
{
    /// <summary>
    /// Finds the entry one student's grade on one problem belongs to, if anybody grades them on it.
    /// </summary>
    /// <param name="dbContext">The operation's database context.</param>
    /// <param name="grants">Reads when a student started preparing the competitions.</param>
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
                problem.RoundId,
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

        // When the student started preparing the competitions, if they ever did.
        var preparerSince = await grants.GetGrantedAtAsync(
            userId, UserCapability.PrepareCompetitions, cancellationToken);

        // The entry and when its conversations count, where anybody grades it.
        return GradedEntry.Of(
            new SpentEntry(
                entry.Id,
                userId,
                lookup.RoundId,
                entry.StartedAt,
                entry.FinishedAt,
                lookup.ClosesAt,
                lookup.ClockMinutes),
            preparerSince);
    }

    /// <summary>
    /// Finds the entry one student's grade on one problem belongs to, where there is something to grade: anybody
    /// grades them on it, and they started a conversation about it while the entry counted.
    /// </summary>
    /// <param name="dbContext"><inheritdoc cref="FindGradedEntryAsync" path="/param[@name='dbContext']"/></param>
    /// <param name="grants"><inheritdoc cref="FindGradedEntryAsync" path="/param[@name='grants']"/></param>
    /// <param name="problemId"><inheritdoc cref="FindGradedEntryAsync" path="/param[@name='problemId']"/></param>
    /// <param name="userId"><inheritdoc cref="FindGradedEntryAsync" path="/param[@name='userId']"/></param>
    /// <param name="cancellationToken">
    /// <inheritdoc cref="FindGradedEntryAsync" path="/param[@name='cancellationToken']"/></param>
    /// <returns>
    /// The entry and the window its conversations count in, or null when nobody grades the student on the problem
    /// or nothing they said about it counts.
    /// </returns>
    public static async Task<GradedEntry?> FindGradableEntryAsync(
        MathCompsDbContext dbContext,
        IUserGrantService grants,
        Guid problemId,
        Guid userId,
        CancellationToken cancellationToken)
    {
        // The entry the grade belongs to, if anybody grades the student on the problem.
        var entry = await FindGradedEntryAsync(dbContext, grants, problemId, userId, cancellationToken);

        // Nobody grades the student on the problem.
        if (entry is null)
            return null;

        // When each of the student's conversations about the problem started.
        var startedAts = await dbContext.ProblemDefenses
            .AsNoTracking()
            .Where(defense => defense.ProblemId == problemId && defense.DefenseSession.UserId == userId)
            .Select(defense => defense.DefenseSession.CreatedAt)
            .ToListAsync(cancellationToken);

        // The entry, where one of them started while it counted.
        return startedAts.Any(entry.Window.Holds) ? entry : null;
    }

    /// <summary>
    /// Reads where spent entries stand on the problems of their rounds: which of them anybody grades, and for those,
    /// how many of the student's conversations about each problem count, the grade on it, and how far into their own
    /// clock they last wrote about it.
    /// </summary>
    /// <remarks>
    /// A conversation counts when it started inside its entry's window, and a line the student wrote counts toward
    /// <see cref="ProblemGradings.FinishedAfter"/> when it was written inside the window.
    /// </remarks>
    /// <param name="dbContext">The operation's database context.</param>
    /// <param name="grants"><inheritdoc cref="FindGradedEntryAsync" path="/param[@name='grants']"/></param>
    /// <param name="entries">The entries, into any rounds.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>Where each graded entry stands on each problem of its round.</returns>
    public static async Task<ProblemGradings> ReadProblemGradingsAsync(
        MathCompsDbContext dbContext,
        IUserGrantService grants,
        IReadOnlyCollection<SpentEntry> entries,
        CancellationToken cancellationToken)
    {
        // No entries, nothing to read.
        if (entries.Count == 0)
            return ProblemGradings.None;

        // When each entrant who prepares the competitions started doing so.
        var preparerSince = await grants.GetGrantedAtAsync(
            [.. entries.Select(entry => entry.UserId).Distinct()],
            UserCapability.PrepareCompetitions,
            cancellationToken);

        // The entries anybody grades, each with the window its conversations count in.
        var graded = entries
            .Select(entry => GradedEntry.Of(
                entry, preparerSince.TryGetValue(entry.UserId, out var since) ? since : null))
            .OfType<GradedEntry>()
            .ToList();

        // None of them graded, nothing more to read.
        if (graded.Count == 0)
            return ProblemGradings.None;

        // Each graded entry by its student and its round, the pair a student holds one entry in.
        var entryOf = graded.ToDictionary(entry => (entry.UserId, entry.RoundId));

        // The graded entries' students.
        var userIds = graded.Select(entry => entry.UserId).Distinct().ToList();

        // The graded entries' rounds.
        var roundIds = graded.Select(entry => entry.RoundId).Distinct().ToList();

        // Every conversation those students held about those rounds' problems: who held it, when it started, and
        // when the student wrote each of their lines in it.
        var conversations = await dbContext.ProblemDefenses
            .AsNoTracking()
            .Where(defense => roundIds.Contains(defense.Problem.RoundId)
                && userIds.Contains(defense.DefenseSession.UserId))
            .Select(defense => new
            {
                defense.DefenseSession.UserId,
                defense.Problem.RoundId,
                defense.ProblemId,
                defense.DefenseSession.CreatedAt,
                LinesWrittenAt = defense.DefenseSession.Turns
                    .Where(turn => turn.Role == TranscriptRole.Candidate)
                    .Select(turn => turn.CreatedAt)
                    .ToList(),
            })
            .ToListAsync(cancellationToken);

        // Each conversation under the entry it was held in, where the student holds one in the round.
        var held = conversations
            .Where(conversation => entryOf.ContainsKey((conversation.UserId, conversation.RoundId)))
            .Select(conversation => (
                Entry: entryOf[(conversation.UserId, conversation.RoundId)],
                conversation.ProblemId,
                conversation.CreatedAt,
                conversation.LinesWrittenAt))
            .ToList();

        // The conversations counted per entry and problem, only those started inside the entry's window.
        var conversationCounts = held
            .Where(conversation => conversation.Entry.Window.Holds(conversation.CreatedAt))
            .CountBy(conversation => (conversation.Entry.Id, conversation.ProblemId))
            .ToDictionary(count => count.Key, count => count.Value);

        // The last line inside its entry's window on each problem, as far into the entry's clock as it came, summed
        // per entry. A problem written nothing about inside the window adds nothing.
        var finishingTimes = held
            .SelectMany(conversation => conversation.LinesWrittenAt
                .Where(conversation.Entry.Window.Holds)
                .Select(writtenAt => (conversation.Entry, conversation.ProblemId, WrittenAt: writtenAt)))
            .GroupBy(line => (line.Entry, line.ProblemId))
            .Select(problem => (
                problem.Key.Entry,
                Into: problem.Max(line => line.WrittenAt) - problem.Key.Entry.Window.StartedAt))
            .GroupBy(problem => problem.Entry.Id)
            .ToDictionary(
                entry => entry.Key,
                entry => entry.Aggregate(TimeSpan.Zero, (sum, problem) => sum + problem.Into));

        // The graded entries' ids.
        var entryIds = graded.Select(entry => entry.Id).ToList();

        // Where the entries' grades stand, by entry and problem, as far as anybody but the graders reads them.
        var grades = await CurrentVersions(dbContext, grade => entryIds.Contains(grade.EntryId))
            .Select(grade => new
            {
                grade.EntryId,
                grade.ProblemId,
                Mark = new GradeMark(grade.Mark, grade.Help, grade.IsFinal),
            })
            .ToDictionaryAsync(grade => (grade.EntryId, grade.ProblemId), grade => grade.Mark, cancellationToken);

        // The graded entries, the counts, the grades and the finishing times.
        return new ProblemGradings(entryIds, conversationCounts, grades, finishingTimes);
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
    /// Reads where the grades of entries stand, everything the graders wrote included.
    /// </summary>
    /// <param name="dbContext">The operation's database context.</param>
    /// <param name="entryIds">The entries.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>Each grade, by entry and problem, where anybody has given one.</returns>
    public static async Task<Dictionary<(Guid EntryId, Guid ProblemId), GradeDto>> ReadCurrentGradesAsync(
        MathCompsDbContext dbContext, IReadOnlyCollection<Guid> entryIds, CancellationToken cancellationToken) =>
        // The newest version of every grade of the entries
        (await ReadCurrentGradesAsync(dbContext, grade => entryIds.Contains(grade.EntryId), cancellationToken))
            .ToDictionary(current => (current.EntryId, current.ProblemId), current => current.Grade);

    /// <summary>
    /// Whether one entry's grade on one problem stands final.
    /// </summary>
    /// <param name="dbContext">The operation's database context.</param>
    /// <param name="entryId">The entry.</param>
    /// <param name="problemId">The problem.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>Whether the newest version is final; false while nobody has given one.</returns>
    public static Task<bool> IsFinalAsync(
        MathCompsDbContext dbContext, Guid entryId, Guid problemId, CancellationToken cancellationToken) =>
        // The newest version of this one grade, final
        CurrentVersions(dbContext, grade => grade.EntryId == entryId && grade.ProblemId == problemId)
            .AnyAsync(grade => grade.IsFinal, cancellationToken);

    /// <summary>
    /// Names the conversation between the graders and one student about one problem, one per grade.
    /// </summary>
    /// <param name="problemId">The problem.</param>
    /// <param name="userId">The student.</param>
    /// <returns>The conversation's comment thread.</returns>
    public static string ConversationTargetId(Guid problemId, Guid userId) =>
        // The problem and the student around a colon
        $"{problemId}:{userId}";

    /// <summary>
    /// Reads a grade conversation's name back into the problem and the student it is about.
    /// </summary>
    /// <param name="targetId">The name of a comment thread.</param>
    /// <param name="problemId">The problem, when <paramref name="targetId"/> names a grade conversation.</param>
    /// <param name="userId">The student, when <paramref name="targetId"/> names a grade conversation.</param>
    /// <returns>Whether the name is one <see cref="ConversationTargetId"/> builds.</returns>
    public static bool TryParseConversationTargetId(string targetId, out Guid problemId, out Guid userId)
    {
        // Empty ids where the name does not split in two
        problemId = Guid.Empty;
        userId = Guid.Empty;

        // Exactly two ids around one colon
        return targetId.Split(':') is [var problemText, var userText]
            && Guid.TryParse(problemText, out problemId)
            && Guid.TryParse(userText, out userId);
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
        CancellationToken cancellationToken) =>
        // The versions in scope that nothing newer replaces, each with its author as the byline
        CurrentVersions(dbContext, scope)
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

    /// <summary>
    /// The versions of grades in scope that nothing newer replaces, which is where each grade stands.
    /// </summary>
    /// <param name="dbContext">The operation's database context.</param>
    /// <param name="scope">Which versions to read among.</param>
    /// <returns>The current versions, untracked.</returns>
    private static IQueryable<HostedGrade> CurrentVersions(
        MathCompsDbContext dbContext, Expression<Func<HostedGrade, bool>> scope)
    {
        // Every version of every grade.
        var versions = dbContext.HostedGrades;

        // The versions in scope that nothing newer replaces.
        return versions
            .AsNoTracking()
            .Where(scope)
            .Where(grade => !versions.Any(newer =>
                newer.EntryId == grade.EntryId
                && newer.ProblemId == grade.ProblemId
                && newer.CreatedAt > grade.CreatedAt));
    }

    /// <summary>
    /// A grade where it stands, with the entry and the problem it is for.
    /// </summary>
    /// <param name="EntryId"><inheritdoc cref="HostedGrade.EntryId" path="/summary"/></param>
    /// <param name="ProblemId"><inheritdoc cref="HostedGrade.ProblemId" path="/summary"/></param>
    /// <param name="Grade">The grade.</param>
    private sealed record CurrentGrade(Guid EntryId, Guid ProblemId, GradeDto Grade);

    /// <summary>
    /// Where graded entries stand on the problems of their rounds.
    /// </summary>
    /// <param name="gradedEntryIds">The entries anybody grades.</param>
    /// <param name="conversationCounts">How many conversations count, by entry and problem, where any do.</param>
    /// <param name="grades">The grade, by entry and problem, where anybody has given one.</param>
    /// <param name="finishingTimes">
    /// The <see cref="FinishedAfter"/> of each entry whose student wrote anything inside its window.
    /// </param>
    public sealed class ProblemGradings(
        IReadOnlyCollection<Guid> gradedEntryIds,
        IReadOnlyDictionary<(Guid EntryId, Guid ProblemId), int> conversationCounts,
        IReadOnlyDictionary<(Guid EntryId, Guid ProblemId), GradeMark> grades,
        IReadOnlyDictionary<Guid, TimeSpan> finishingTimes)
    {
        /// <summary>
        /// Gradings holding no graded entry.
        /// </summary>
        public static ProblemGradings None { get; } = new(
            [],
            new Dictionary<(Guid, Guid), int>(),
            new Dictionary<(Guid, Guid), GradeMark>(),
            new Dictionary<Guid, TimeSpan>());

        /// <summary>
        /// The entries anybody grades.
        /// </summary>
        private readonly HashSet<Guid> _gradedEntryIds = [.. gradedEntryIds];

        /// <summary>
        /// The entries with a counted conversation about any problem of their round.
        /// </summary>
        private readonly HashSet<Guid> _spokenEntryIds = [.. conversationCounts.Keys.Select(key => key.EntryId)];

        /// <summary>
        /// Where one entry stands on one problem of its round.
        /// </summary>
        /// <param name="entryId">The entry.</param>
        /// <param name="problemId">The problem.</param>
        /// <returns>The entry's counted conversations and grade on the problem.</returns>
        public ProblemGrading Of(Guid entryId, Guid problemId) =>
            // Nothing read for the pair is no conversation and no grade
            new(
                conversationCounts.GetValueOrDefault((entryId, problemId)),
                grades.GetValueOrDefault((entryId, problemId)));

        /// <summary>
        /// Whether anybody grades the entry.
        /// </summary>
        /// <param name="entryId">The entry.</param>
        /// <returns>Whether it is graded.</returns>
        public bool IsGraded(Guid entryId) =>
            // Among the graded ones
            _gradedEntryIds.Contains(entryId);

        /// <summary>
        /// Whether the student held a conversation about any problem of their round while the entry counted.
        /// </summary>
        /// <param name="entryId">The entry.</param>
        /// <returns>Whether any of their conversations counts.</returns>
        public bool HasSpoken(Guid entryId) =>
            // Any problem with a counted conversation
            _spokenEntryIds.Contains(entryId);

        /// <summary>
        /// The sum, over the problems of the student's round, of how far into their own clock they last wrote about
        /// each one inside their window, which breaks a tie on the total.
        /// </summary>
        /// <param name="entryId">The entry.</param>
        /// <returns>The sum, nothing written inside the window summing to nothing.</returns>
        public TimeSpan FinishedAfter(Guid entryId) =>
            // Nothing written inside the window is no time at all
            finishingTimes.GetValueOrDefault(entryId);
    }

    /// <summary>
    /// Where one graded entry stands on one problem of its round.
    /// </summary>
    /// <param name="Conversations">
    /// How many of the student's conversations about the problem started inside the entry's window.
    /// </param>
    /// <param name="Grade">The grade, or null while nobody has given one.</param>
    public sealed record ProblemGrading(int Conversations, GradeMark? Grade);

    /// <summary>
    /// A grade as far as anybody but the graders reads it: what they wrote for each other stays out.
    /// </summary>
    /// <param name="Mark"><inheritdoc cref="HostedGrade.Mark" path="/summary"/></param>
    /// <param name="Help"><inheritdoc cref="HostedGrade.Help" path="/summary"/></param>
    /// <param name="IsFinal"><inheritdoc cref="HostedGrade.IsFinal" path="/summary"/></param>
    public sealed record GradeMark(int? Mark, int Help, bool IsFinal);

    /// <summary>
    /// An entry a student spent, with the close and the clock of the group it was spent into.
    /// </summary>
    /// <param name="Id">The entry.</param>
    /// <param name="UserId"><inheritdoc cref="HostedEntry.UserId" path="/summary"/></param>
    /// <param name="RoundId"><inheritdoc cref="HostedEntry.RoundId" path="/summary"/></param>
    /// <param name="StartedAt"><inheritdoc cref="HostedEntry.StartedAt" path="/summary"/></param>
    /// <param name="FinishedAt"><inheritdoc cref="HostedEntry.FinishedAt" path="/summary"/></param>
    /// <param name="ClosesAt"><inheritdoc cref="HostedGroup.ClosesAt" path="/summary"/></param>
    /// <param name="ClockMinutes"><inheritdoc cref="HostedGroup.ClockMinutes" path="/summary"/></param>
    public sealed record SpentEntry(
        Guid Id,
        Guid UserId,
        Guid RoundId,
        DateTimeOffset? StartedAt,
        DateTimeOffset? FinishedAt,
        DateTimeOffset? ClosesAt,
        int ClockMinutes);

    /// <summary>
    /// An entry that is graded, with the window its conversations count in.
    /// </summary>
    /// <param name="Id">The entry.</param>
    /// <param name="UserId"><inheritdoc cref="HostedEntry.UserId" path="/summary"/></param>
    /// <param name="RoundId"><inheritdoc cref="HostedEntry.RoundId" path="/summary"/></param>
    /// <param name="Window">When the entry's conversations count.</param>
    public sealed record GradedEntry(Guid Id, Guid UserId, Guid RoundId, EntryWindow Window)
    {
        /// <summary>
        /// One entry as it is graded: an entry the student sat, in a run somebody grades.
        /// </summary>
        /// <param name="entry">The entry.</param>
        /// <param name="preparerSince">
        /// <inheritdoc cref="HostedEntryRules.IsTestRun" path="/param[@name='preparerSince']"/></param>
        /// <returns>The entry and its window; null when nobody grades it.</returns>
        public static GradedEntry? Of(SpentEntry entry, DateTimeOffset? preparerSince) =>
            // Graded only when the student sat the entry and somebody grades the run.
            entry.StartedAt is { } clockStartedAt
            && HostedEntryRules.IsGraded(entry.ClosesAt, HostedEntryRules.IsTestRun(preparerSince, clockStartedAt))
                ? new GradedEntry(
                    entry.Id,
                    entry.UserId,
                    entry.RoundId,
                    new EntryWindow(
                        clockStartedAt,
                        HostedEntryRules.EndedAt(clockStartedAt, entry.FinishedAt, entry.ClockMinutes)))
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

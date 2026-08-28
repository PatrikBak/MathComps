using MathComps.Domain.Contracts.Competitions;
using MathComps.Domain.Contracts.Defense;
using MathComps.Domain.EfCoreEntities;
using MathComps.Domain.Localization;
using MathComps.Domain.Taxonomy;
using MathComps.Infrastructure.Options;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Defense;
using MathComps.Infrastructure.Services.Localization;
using MathComps.Shared.Extensions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Npgsql;

namespace MathComps.Infrastructure.Services.Competitions;

/// <summary>
/// Implements <see cref="IHostedCompetitionService"/> over the database. A hosted competition is a round of the
/// taxonomy like any other, so everything here is the ordinary archive shape read through the group that says
/// when it runs and the entries students have spent into it.
/// </summary>
/// <param name="dbContextFactory">The factory minting each operation's database context.</param>
/// <param name="localization">Resolves the localized name of the node a competition runs under.</param>
/// <param name="limits">The caps a defense is held to.</param>
/// <param name="options">The terms a hosted competition runs on.</param>
public sealed class HostedCompetitionService(
    IDbContextFactory<MathCompsDbContext> dbContextFactory,
    IMetadataLocalizationService localization,
    IOptions<DefenseLimits> limits,
    IOptions<HostedCompetitionOptions> options)
    : IHostedCompetitionService
{
    /// <inheritdoc cref="DefenseLimitsDto.MaxTurnsPerSession" path="/summary"/>
    private readonly int _maxTurnsPerSession = limits.Value.MaxTurnsPerSession;

    /// <inheritdoc cref="DefenseLimitsDto.MaxFeedbackCommentChars" path="/summary"/>
    private readonly int _maxCommentChars = limits.Value.MaxFeedbackCommentChars;

    /// <inheritdoc cref="HostedCompetitionOptions.NoteGraceMinutes" path="/summary"/>
    private readonly int _noteGraceMinutes = options.Value.NoteGraceMinutes;

    /// <inheritdoc/>
    public async Task<HostedCompetitionsViewDto> GetViewAsync(
        Guid? userId, CancellationToken cancellationToken = default)
    {
        // A fresh context for this operation.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // Every group with its rounds: the node each round runs under, how many problems it holds, and when its
        // problems open. Newest first.
        var groups = await dbContext.HostedGroups
            .AsNoTracking()
            .OrderByDescending(group => group.OpensAt)
            .Select(group => new
            {
                group.Id,
                group.OpensAt,
                group.ClosesAt,
                group.ClockMinutes,
                Rounds = group.Rounds
                    .OrderBy(round => round.Competition.SortPath)
                    .Select(round => new
                    {
                        round.Id,
                        CompetitionPath = round.Competition.Path,
                        round.VisibleSince,
                        ProblemCount = round.Problems.Count,
                    })
                    .ToList(),
            })
            .ToListAsync(cancellationToken);

        // The one entry the reader holds in each competition they have entered. A signed-out visitor holds none,
        // so there is nothing to read.
        var entries = userId is { } reader
            ? await ReadCurrentEntriesAsync(dbContext, reader, cancellationToken)
            : [];

        // When the embargoes are read against.
        var now = DateTimeOffset.UtcNow;

        // The view, one group at a time.
        return new HostedCompetitionsViewDto(
            [
            .. groups.Select(group => new HostedGroupDto(
                group.Id,
                // Every round of a group runs under a node of the same name, so the first names the group.
                NameOf(group.Rounds.Count == 0 ? null : group.Rounds[0].CompetitionPath),
                // The rounds hold the same number of problems, so the first of them says how many.
                group.Rounds.Count == 0 ? 0 : group.Rounds[0].ProblemCount,
                group.ClockMinutes,
                group.OpensAt,
                group.ClosesAt,
                [
                    .. group.Rounds.Select(round => new HostedCompetitionDto(
                        round.Id,
                        HostedTaxonomy.CategoryOf(round.CompetitionPath),
                        entries.GetValueOrDefault(round.Id),
                        // Nobody's results are out.
                        ResultsPublished: false,
                        ProblemsPublished: round.VisibleSince is null || round.VisibleSince <= now)),
                ])),
            ],
            _noteGraceMinutes);
    }

    /// <inheritdoc/>
    public async Task<EntryReadinessDto> GetReadinessAsync(
        Guid userId, CancellationToken cancellationToken = default)
    {
        // A fresh context for this operation.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // What the student's account already holds of what an entry asks for.
        return await dbContext.Users
            .AsNoTracking()
            .Where(user => user.Id == userId)
            .Select(user => new EntryReadinessDto(
                user.Username != null,
                user.GraduationYear != null || user.HasLeftHighSchool,
                user.Email != null,
                user.RulesAcceptedAt != null,
                user.ProfilePromptDismissedAt != null))
            .FirstOrDefaultAsync(cancellationToken)
            ?? throw new InvalidOperationException($"User {userId} was resolved and then vanished.");
    }

    /// <inheritdoc/>
    public async Task DismissProfilePromptAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        // A fresh context for this operation.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // Stamp the moment, filtering on it still being unset so hiding it a second time leaves the first one
        // standing rather than rewriting when they asked
        await dbContext.Users
            .Where(user => user.Id == userId && user.ProfilePromptDismissedAt == null)
            .ExecuteUpdateAsync(
                setters => setters.SetProperty(user => user.ProfilePromptDismissedAt, DateTimeOffset.UtcNow),
                cancellationToken);
    }

    /// <inheritdoc/>
    public Task<SpentEntryDto> EnterAsync(
        Guid userId, Guid roundId, CancellationToken cancellationToken = default)
        // Spent by sitting it, so the clock starts here.
        => SpendEntryAsync(userId, roundId, isForfeit: false, cancellationToken);

    /// <inheritdoc/>
    public Task<SpentEntryDto> ForfeitAsync(
        Guid userId, Guid roundId, CancellationToken cancellationToken = default)
        // Spent by giving it up, so no clock ever runs.
        => SpendEntryAsync(userId, roundId, isForfeit: true, cancellationToken);

    /// <inheritdoc/>
    public async Task<HostedEntryDto> FinishAsync(
        Guid userId, Guid roundId, CancellationToken cancellationToken = default)
    {
        // A fresh context for this operation.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // The entry the student holds in this competition, tracked so the stamp below saves.
        var entry = await dbContext.HostedEntries.FirstOrDefaultAsync(
            candidate => candidate.UserId == userId && candidate.RoundId == roundId, cancellationToken);

        // Only an entry they are currently sitting can be handed in: one given up was over the moment it was
        // spent, and one already closed cannot close twice.
        if (entry is null || entry.StartedAt is null || entry.FinishedAt is not null)
            throw new HostedEntryNotRunningException();

        // Over where the student said, and the clock they left on it goes with it. Whether that counts as handing
        // in early is arithmetic against the group's clock, which the reader does for itself. Stamped no finer
        // than the row will hold it, so the entry this returns matches the same entry read back.
        entry.FinishedAt = DateTimeOffset.UtcNow.TruncateToMicroseconds();

        // The close itself.
        await dbContext.SaveChangesAsync(cancellationToken);

        // The entry as the hand-in left it.
        return ToEntryDto(entry);
    }

    /// <inheritdoc/>
    public async Task<IReadOnlyList<HostedCompetitionProblemDto>> GetProblemsAsync(
        Guid userId, Guid roundId, CancellationToken cancellationToken = default)
    {
        // A fresh context for this operation.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // The problems are the embargoed thing, so what may be read is settled before anything is read.
        await EnsureEntitledAsync(dbContext, userId, roundId, cancellationToken);

        // The set, in the order the competition sets it.
        return await ReadProblemsAsync(dbContext, userId, roundId, cancellationToken);
    }

    /// <inheritdoc/>
    public async Task SetSelfAssessmentAsync(
        Guid userId, Guid roundId, Guid problemId, string comment, CancellationToken cancellationToken = default)
    {
        // What the student wrote, reduced to the text it carries. The words are the whole claim, so a blank
        // one is a bad request rather than a quiet way of dropping what stands.
        var written = comment.TrimToNull() ?? throw new DefenseFeedbackValueException();

        // Held to the same cap as everything else a student writes about a defense.
        if (written.Length > _maxCommentChars)
            throw new DefenseFeedbackCommentTooLongException();

        // A fresh context for this operation.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // A note belongs to a run and closes shortly after it.
        await EnsureNotesOpenAsync(dbContext, userId, roundId, cancellationToken);

        // And the problem has to be one of that competition's own, so a claim can't be filed under a set the
        // entry never opened.
        var isOfRound = await dbContext.Problems
            .AsNoTracking()
            .AnyAsync(problem => problem.Id == problemId && problem.RoundId == roundId, cancellationToken);

        // Named one of somebody else's set, which is not this competition's claim to hold.
        if (!isOfRound)
            throw new HostedProblemNotFoundException();

        // One timestamp, so a first claim reads as never revised.
        var claimedAt = DateTimeOffset.UtcNow;

        // Record it as the student's one and only claim about the problem. Keeping the first stamp out of the
        // update leaves a revision the same row, still saying when they first spoke.
        await dbContext.ProblemSelfAssessments
            .Upsert(new ProblemSelfAssessment
            {
                UserId = userId,
                ProblemId = problemId,
                Comment = written,
                CreatedAt = claimedAt,
                UpdatedAt = claimedAt,
            })
            .On(assessment => new { assessment.UserId, assessment.ProblemId })
            .Exclude(assessment => assessment.CreatedAt)
            .RunAsync(cancellationToken);
    }

    /// <inheritdoc/>
    public async Task ClearSelfAssessmentAsync(
        Guid userId, Guid roundId, Guid problemId, CancellationToken cancellationToken = default)
    {
        // A fresh context for this operation.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // Taking a note back is open for exactly as long as leaving one is.
        await EnsureNotesOpenAsync(dbContext, userId, roundId, cancellationToken);

        // Drop it, the competition riding in the delete itself. A problem they have claimed nothing about, or
        // one of somebody else's set, leaves them where they asked to be.
        await dbContext.ProblemSelfAssessments
            .Where(assessment => assessment.UserId == userId
                && assessment.ProblemId == problemId
                && assessment.Problem.RoundId == roundId)
            .ExecuteDeleteAsync(cancellationToken);
    }

    /// <summary>
    /// Spends a student's entry into one competition, whichever way they are spending it, and hands back the
    /// problems it opens.
    /// </summary>
    /// <param name="userId">The student spending it.</param>
    /// <param name="roundId">The competition being entered.</param>
    /// <param name="isForfeit">Whether they are giving the entry up rather than sitting it.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>The entry as it now stands, and the set it opens.</returns>
    private async Task<SpentEntryDto> SpendEntryAsync(
        Guid userId, Guid roundId, bool isForfeit, CancellationToken cancellationToken)
    {
        // A fresh context for this operation.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // The group the competition runs in, which is what decides whether it is taking entries at all.
        var group = await dbContext.Rounds
            .AsNoTracking()
            .Where(round => round.Id == roundId && round.HostedGroup != null)
            .Select(round => new
            {
                round.HostedGroup!.OpensAt,
                round.HostedGroup.ClosesAt,
                round.HostedGroup.AllowsReentry,
            })
            .FirstOrDefaultAsync(cancellationToken)
            ?? throw new HostedCompetitionNotFoundException();

        // One instant for the checks and for whatever they let through, no finer than a stamp written from it
        // will be held, so the entry this returns matches the same entry read back.
        var now = DateTimeOffset.UtcNow.TruncateToMicroseconds();

        // Announced but not yet open, or past its window: either way there is no entry to take.
        if (group.OpensAt > now || (group.ClosesAt is { } closesAt && closesAt <= now))
            throw new HostedGroupNotOpenException();

        // Whatever the student already holds here, which is at most one row.
        var entry = await dbContext.HostedEntries.FirstOrDefaultAsync(
            candidate => candidate.UserId == userId && candidate.RoundId == roundId, cancellationToken);

        // An entry is spent once, unless the group it runs in is one students may take again.
        if (entry is not null && !group.AllowsReentry)
            throw new HostedEntryAlreadySpentException();

        // What an entry asks of the student's account, settled before anything is written. A group with no
        // closing instant is never graded, so it has no result to name a student in and asks for no fields.
        if (group.ClosesAt is not null)
            await EnsureReadyToEnterAsync(dbContext, userId, cancellationToken);

        // The row the student's run is recorded in, which is the one they already hold when they are taking the
        // group again.
        entry ??= Track(dbContext, userId, roundId);

        // Every stamp written afresh, so nothing of a run before it is left standing beside the new one: what
        // they did in that one is their conversations, and those hang off the problem rather than off this.
        entry.StartedAt = isForfeit ? null : now;
        entry.ForfeitedAt = isForfeit ? now : null;
        entry.FinishedAt = null;

        // The set the entry buys, read before the entry is written: a competition the site cannot serve has to
        // refuse the attempt rather than consume what the student spent on it.
        var problems = await ReadProblemsAsync(dbContext, userId, roundId, cancellationToken);

        // The write itself. An attempt racing another meets it at the index rather than at the read above, which
        // happened before either of them wrote.
        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        // The other attempt got there first, so this one has nothing left to spend.
        catch (DbUpdateException exception) when (IsOneEntryCollision(exception))
        {
            throw new HostedEntryAlreadySpentException();
        }

        // Spending an entry is where the rules are put in front of a student, so the first one they spend is
        // where they accept them. After the entry, so an acceptance is only ever recorded against one taken.
        await dbContext.Users
            .Where(user => user.Id == userId && user.RulesAcceptedAt == null)
            .ExecuteUpdateAsync(
                update => update.SetProperty(user => user.RulesAcceptedAt, now), cancellationToken);

        // The stamped row paired with the problems read above.
        return new SpentEntryDto(ToEntryDto(entry), problems);
    }

    /// <summary>
    /// Throws unless the student's account holds everything an entry asks of them.
    /// </summary>
    /// <remarks>
    /// Checked before the entry goes through, so nothing is ever spent by an account still short of what an
    /// entry asks.
    /// </remarks>
    /// <param name="dbContext">The operation's database context.</param>
    /// <param name="userId">The student entering.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    private static async Task EnsureReadyToEnterAsync(
        MathCompsDbContext dbContext, Guid userId, CancellationToken cancellationToken)
    {
        // Whether the account carries what an entry asks for. Having left school answers the graduation question
        // as much as a year does, and leaves no year behind.
        var isReady = await dbContext.Users
            .AsNoTracking()
            .AnyAsync(
                user => user.Id == userId
                    && user.Username != null
                    && (user.GraduationYear != null || user.HasLeftHighSchool)
                    && user.Email != null,
                cancellationToken);

        // Short of what an entry asks for, there is no entry to take.
        if (!isReady)
            throw new HostedEntryProfileIncompleteException();
    }

    /// <summary>
    /// Tracks a student's first entry into one competition.
    /// </summary>
    /// <param name="dbContext">The operation's database context.</param>
    /// <param name="userId">The student entering.</param>
    /// <param name="roundId">The competition entered.</param>
    /// <returns>The tracked entry.</returns>
    private static HostedEntry Track(MathCompsDbContext dbContext, Guid userId, Guid roundId)
    {
        // The row.
        var entry = new HostedEntry { UserId = userId, RoundId = roundId };

        // Tracked for the operation's save.
        dbContext.HostedEntries.Add(entry);

        // Back for the caller to stamp.
        return entry;
    }

    /// <summary>
    /// Says whether a failed save is a second entry into a competition that holds one.
    /// </summary>
    /// <param name="exception">The failure the save reported.</param>
    /// <returns>True when the index over the entries refused the row.</returns>
    private static bool IsOneEntryCollision(DbUpdateException exception) =>
        // Narrow on the index by name: any other violation is a fault rather than a race this understands.
        exception.InnerException is PostgresException
        {
            SqlState: PostgresErrorCodes.UniqueViolation,
            ConstraintName: "ux_hosted_entry_user_id_round_id",
        };

    /// <summary>
    /// Reads one competition's problems with the student's conversations about each, and what they claim of
    /// their own solution.
    /// </summary>
    /// <param name="dbContext">The operation's database context.</param>
    /// <param name="userId">The student reading.</param>
    /// <param name="roundId">The competition whose problems these are.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>The problems, in the order the competition sets them.</returns>
    private async Task<IReadOnlyList<HostedCompetitionProblemDto>> ReadProblemsAsync(
        MathCompsDbContext dbContext, Guid userId, Guid roundId, CancellationToken cancellationToken)
    {
        // The set, each problem with its statement in every language. Markdown is what the site renders, the raw
        // source standing in on a row that carries none.
        var problems = await dbContext.Problems
            .AsNoTracking()
            .Where(problem => problem.RoundId == roundId)
            .OrderBy(problem => problem.Number)
            .Select(problem => new
            {
                problem.Id,
                problem.Number,
                Statements = problem.Texts
                    .Where(text => text.DocumentType == DocumentType.Statement)
                    .Select(text => new StatementText(text.Language, text.MarkdownText ?? text.RawText))
                    .ToList(),
            })
            .ToListAsync(cancellationToken);

        // The ids the conversations are looked up by.
        var problemIds = problems.Select(problem => problem.Id).ToList();

        // The student's conversations about those problems, most recently active first, each counted down to what
        // a row on the problem says. Nothing of what was said comes back: the last line is usually the examiner's
        // challenge, and handing it over would spoil it.
        var defenses = await dbContext.ProblemDefenses
            .AsNoTracking()
            .Where(defense => problemIds.Contains(defense.ProblemId)
                && defense.DefenseSession.UserId == userId)
            .OrderByDescending(defense => defense.DefenseSession.Turns.Max(turn => turn.CreatedAt))
            .Select(defense => new
            {
                defense.ProblemId,
                Line = new HostedCompetitionDefenseLineDto(
                    defense.DefenseSessionId,
                    defense.DefenseSession.CreatedAt,
                    defense.DefenseSession.Turns.Count(turn => turn.Role == TranscriptRole.Candidate),
                    _maxTurnsPerSession),
            })
            .ToListAsync(cancellationToken);

        // What the student currently claims about each of those solutions, for the problems they have said
        // anything about. Keyed on them and the problem, so a claim made in an earlier run is still theirs.
        var assessments = await dbContext.ProblemSelfAssessments
            .AsNoTracking()
            .Where(assessment => problemIds.Contains(assessment.ProblemId) && assessment.UserId == userId)
            .ToDictionaryAsync(
                assessment => assessment.ProblemId,
                assessment => assessment.Comment,
                cancellationToken);

        // Each problem with the conversations held about it and what the student makes of their own solution.
        return
        [
            .. problems.Select(problem => new HostedCompetitionProblemDto(
                problem.Id,
                problem.Number,
                Enum.GetValues<Language>().ToDictionary(
                    language => language,
                    language => BodyIn(problem.Statements, language)),
                [
                    .. defenses
                        .Where(defense => defense.ProblemId == problem.Id)
                        .Select(defense => defense.Line),
                ],
                assessments.GetValueOrDefault(problem.Id),
                _maxCommentChars)),
        ];
    }

    /// <summary>
    /// Reads the entry a student holds in each competition they have entered, which is one per competition:
    /// taking a group again resets the row rather than adding another.
    /// </summary>
    /// <param name="dbContext">The operation's database context.</param>
    /// <param name="userId">The student reading.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>The entry, keyed by the round it was taken into.</returns>
    private static async Task<Dictionary<Guid, HostedEntryDto>> ReadCurrentEntriesAsync(
        MathCompsDbContext dbContext, Guid userId, CancellationToken cancellationToken)
    {
        // Every entry the student holds.
        var entries = await dbContext.HostedEntries
            .AsNoTracking()
            .Where(entry => entry.UserId == userId)
            .ToListAsync(cancellationToken);

        // One per competition, the index over the pair being what makes that so.
        return entries.ToDictionary(entry => entry.RoundId, ToEntryDto);
    }

    /// <summary>
    /// Throws unless the student may read a competition's problems: its embargo has passed, or they hold an entry
    /// they have spent into it.
    /// </summary>
    /// <param name="dbContext">The operation's database context.</param>
    /// <param name="userId">The student reading.</param>
    /// <param name="roundId">The competition whose problems they are reaching for.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    private static async Task EnsureEntitledAsync(
        MathCompsDbContext dbContext, Guid userId, Guid roundId, CancellationToken cancellationToken)
    {
        // The round, which is absent unless the site hosts it.
        var round = await dbContext.Rounds
            .AsNoTracking()
            .FirstOrDefaultAsync(
                candidate => candidate.Id == roundId && candidate.HostedGroupId != null, cancellationToken)
            ?? throw new HostedCompetitionNotFoundException();

        // And past that it is the same rule a conversation about one of its problems is opened under.
        await HostedEntryRules.EnsureEntitledAsync(
            dbContext, userId, roundId, round.VisibleSince, cancellationToken);
    }

    /// <summary>
    /// Throws unless the student may still say something about a round's solutions: they sat an entry into it
    /// rather than giving it up, and its grace has not run out, if it has ended at all.
    /// </summary>
    /// <remarks>
    /// Stricter than the read rule above, which lets anybody read a set out of embargo. What a student says
    /// about their own solution is read beside the transcript they argued it in, and that transcript stops
    /// where the entry does, so what is said about it has to stop shortly after.
    /// </remarks>
    /// <param name="dbContext">The operation's database context.</param>
    /// <param name="userId">The student writing.</param>
    /// <param name="roundId">The competition they are writing under.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    private async Task EnsureNotesOpenAsync(
        MathCompsDbContext dbContext, Guid userId, Guid roundId, CancellationToken cancellationToken)
    {
        // Their entry with the clock it was given, absent unless the site hosts the round and they spent one.
        var entry = await dbContext.HostedEntries
            .AsNoTracking()
            .Where(candidate => candidate.UserId == userId
                && candidate.RoundId == roundId
                && candidate.Round.HostedGroup != null)
            .Select(candidate => new
            {
                candidate.StartedAt,
                candidate.FinishedAt,
                candidate.Round.HostedGroup!.ClockMinutes,
            })
            .FirstOrDefaultAsync(cancellationToken)
            // Nothing spent here, so there is no run of theirs to say anything in.
            ?? throw new HostedEntryRequiredException();

        // An entry given up for the problems was never a run, so nothing was argued in it to speak about.
        if (entry.StartedAt is not { } startedAt)
            throw new HostedEntryNotRunningException();

        // Where the entry stopped counting: the clock running out, or the student closing it ahead of that.
        var clockRunsOutAt = startedAt.AddMinutes(entry.ClockMinutes);
        var endedAt = entry.FinishedAt is { } finishedAt && finishedAt < clockRunsOutAt
            ? finishedAt
            : clockRunsOutAt;

        // Past the grace that follows it, so the note and the transcript have both settled.
        if (endedAt.AddMinutes(_noteGraceMinutes) <= DateTimeOffset.UtcNow)
            throw new HostedEntryNotRunningException();
    }

    /// <summary>
    /// One language's statement of one problem.
    /// </summary>
    /// <param name="Language">The language it is written in.</param>
    /// <param name="Body">The statement's text, null on a row that holds none.</param>
    private sealed record StatementText(Language Language, string? Body);

    /// <summary>
    /// Picks one language's statement out of a problem's texts.
    /// </summary>
    /// <remarks>
    /// A hosted problem is written in every language the site is read in, which the declaration refuses a group
    /// without. A gap throws rather than serving a blank, which would put an empty statement in front of a
    /// student sitting a clock.
    /// </remarks>
    /// <param name="texts">The problem's statements, one per language it has been written in.</param>
    /// <param name="language">The language wanted.</param>
    /// <returns>The statement.</returns>
    private static string BodyIn(IEnumerable<StatementText> texts, Language language) =>
        texts.FirstOrDefault(text => text.Language == language)?.Body
        ?? throw new InvalidOperationException($"A hosted problem carries no {language} statement.");

    /// <summary>
    /// Reads a node's name in every language the site is read in.
    /// </summary>
    /// <param name="competitionPath">The node's path, or null when the group runs no rounds to take it from.</param>
    /// <returns>The name in each language, blank throughout for a group with nothing under it.</returns>
    private IReadOnlyDictionary<Language, string> NameOf(string? competitionPath) =>
        Enum.GetValues<Language>().ToDictionary(
            language => language,
            // A group with no rounds has no node to take a name from.
            language => competitionPath is null
                ? string.Empty
                : localization.GetNodeShortName(language, competitionPath));

    /// <summary>
    /// Picks the <see cref="HostedEntryDto"/> arm an entry's stamps say it is.
    /// </summary>
    /// <param name="entry">The entry to project.</param>
    /// <returns>The arm matching the way the entry was spent.</returns>
    private static HostedEntryDto ToEntryDto(HostedEntry entry) =>
        // A forfeit stamp is what separates the two, no clock ever having run on one given up.
        entry.ForfeitedAt is { } forfeitedAt
            ? new ForfeitedEntryDto(forfeitedAt)
            : new SatEntryDto(entry.StartedAt!.Value, entry.FinishedAt);
}

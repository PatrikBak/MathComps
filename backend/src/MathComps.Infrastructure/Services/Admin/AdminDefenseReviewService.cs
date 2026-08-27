using System.Text.Json;
using MathComps.Domain.Contracts.Admin;
using MathComps.Domain.Contracts.Defense;
using MathComps.Domain.Contracts.Helpers;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Extensions;
using MathComps.Infrastructure.Options;
using MathComps.Infrastructure.Pagination;
using MathComps.Infrastructure.Persistence;
using MathComps.Domain.Localization;
using MathComps.Infrastructure.Services.Defense;
using MathComps.Infrastructure.Services.Localization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace MathComps.Infrastructure.Services.Admin;

/// <summary>
/// Implements <see cref="IAdminDefenseReviewService"/> over the database. The queue is read off one filtered query,
/// so that whether a conversation counts as unread is written once and the queue's filter and each row's own mark
/// can't drift apart.
/// </summary>
/// <param name="dbContextFactory">The factory minting each operation's database context.</param>
/// <param name="paginationOptions">The bounds a page of the queue is cut by.</param>
/// <param name="localization">The resolver of localized display names.</param>
public class AdminDefenseReviewService(
    IDbContextFactory<MathCompsDbContext> dbContextFactory,
    IOptions<PaginationOptions> paginationOptions,
    IMetadataLocalizationService localization)
    : IAdminDefenseReviewService
{
    /// <summary>
    /// How much of a student's most recent message a queue row carries. A row shows one line of it, and the whole
    /// message can run to thousands of characters across a page of them.
    /// </summary>
    private const int LastStudentMessageChars = 300;

    /// <summary>
    /// The furthest back a period may reach, in days. Bounded rather than merely floored because the date the
    /// period is measured from is today less that many days, and a large enough one falls off the calendar.
    /// </summary>
    private const int MaxWithinDays = 3650;

    /// <inheritdoc/>
    public async Task<PagedList<AdminDefenseConversationDto>> GetQueueAsync(
        Guid reviewerId,
        AdminDefenseQueueFilter filter,
        int pageNumber,
        Language language,
        CancellationToken cancellationToken = default)
    {
        // The page as it will be served, which is how much of the queue one request can ask for.
        var bounds = PageBounds.ForServerPage(paginationOptions.Value, pageNumber);

        // This read's own context, since reading a page of the queue is a unit of work in itself.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // Conversations held against a problem, narrowed by every filter the stored data can answer on its own.
        var sessions = ApplySessionFilters(dbContext, filter);

        // Each of them paired with when it last moved and when this reviewer last read it, left-joined so one they
        // have never read still comes through. Whether it counts as unread is worked out here, once, and read back
        // by both the filter below and each row's own mark. The shape is anonymous because the page below joins
        // back to the conversation it came from, which a projection into the response's own type doesn't survive.
        var joined =
            from session in sessions
            join review in dbContext.AdminSessionReviews.Where(review => review.ReviewerId == reviewerId)
                on session.Id equals review.SessionId into reviews
            from review in reviews.DefaultIfEmpty()
            let lastActivityAt = session.Turns.Max(turn => turn.CreatedAt)
            // The cast is what carries a missed join through as no stamp rather than a default one.
            let readAt = (DateTimeOffset?)review.ReadAt
            select new
            {
                SessionId = session.Id,
                LastActivityAt = lastActivityAt,
                ReadAt = readAt,
                IsUnread = readAt == null || lastActivityAt > readAt,
            };

        // Conversations carrying turns this reviewer hasn't read.
        var rows = filter.Unread ? joined.Where(row => row.IsUnread) : joined;

        // How recently a conversation has to have moved. Measured from the last thing said rather than from when it
        // started, since one carried on today is a today conversation however long ago it opened.
        if (filter.WithinDays is { } withinDays)
        {
            // Anything under a day is a request for nothing, and anything past the ceiling reaches back further
            // than the arithmetic can go, so hold it to the range a period actually means something over.
            var since = DateTimeOffset.UtcNow.AddDays(-Math.Clamp(withinDays, 1, MaxWithinDays));

            // Keep the ones that have moved since then.
            rows = rows.Where(row => row.LastActivityAt >= since);
        }

        // How many conversations the filters match in all, which is what the pages are counted in.
        var totalCount = await rows.CountAsync(cancellationToken);

        // The sets the projection below reads. Held as their own values so the expression tree captures a set
        // rather than the context around it, which the analyzer reads as disposed by the time the tree runs.
        var allSessions = dbContext.DefenseSessions;
        var allNotes = dbContext.AdminNotes;

        // The page itself, the conversations spoken to most recently first. The ids break ties so that two last
        // spoken to in the same instant can't swap places between one page and the next. Cutting the page before
        // the join is what keeps the per-row extras paid for on the page rather than on everything matched.
        var page = await rows
            .OrderByDescending(row => row.LastActivityAt)
            .ThenBy(row => row.SessionId)
            .Skip(bounds.Skip)
            .Take(bounds.PageSize)
            .Join(
                allSessions,
                row => row.SessionId,
                session => session.Id,
                (row, session) => new QueueRow(
                    session.Id,
                    new NamedDefenseTargets.Columns(
                        session.EnvironmentTarget!.HandoutEnvironment.Handout.ContentId,
                        session.EnvironmentTarget!.HandoutEnvironment.ContentId,
                        session.ProblemTarget!.ProblemId,
                        session.ProblemTarget!.Problem.RoundId,
                        session.ProblemTarget!.Problem.Slug,
                        session.ProblemTarget!.Problem.Number,
                        session.ProblemTarget!.Problem.Round.Competition.Path,
                        session.ProblemTarget!.Problem.Round.Season.EditionNumber,
                        session.ProblemTarget!.Problem.Round.Season.StartYear),
                    new AdminDefenseUserDto(
                        session.User.Id,
                        session.User.IsDeleted ? null : session.User.Username,
                        session.User.Email),
                    session.Turns
                        .Where(turn => turn.Role == TranscriptRole.Candidate)
                        .OrderByDescending(turn => turn.Sequence)
                        .Select(turn => turn.Content.Substring(0, LastStudentMessageChars))
                        .FirstOrDefault(),
                    session.Turns.Count,
                    row.LastActivityAt,
                    row.ReadAt,
                    session.Turns.Count(turn => row.ReadAt == null || turn.CreatedAt > row.ReadAt),
                    allNotes.Count(note => note.SessionId == session.Id),
                    session.Reports.Any(),
                    session.Feedback != null))
            .ToListAsync(cancellationToken);

        // Put the page back in order, which the join above is under no obligation to have kept: most recently
        // spoken to first, ties broken by id. The id is compared as the ordinal text of its canonical form, which
        // is the order the database cut the page by, since Postgres compares a uuid as its sixteen bytes and that
        // text spells those bytes out in order. Comparing the ids themselves is a different order, and one that
        // disagrees, so a conversation could sit on one side of a page boundary in the database and the other here.
        var conversations = page
            .OrderByDescending(row => row.LastActivityAt)
            .ThenBy(row => row.Id.ToString(), StringComparer.Ordinal)
            .Select(row => new AdminDefenseConversationDto(
                row.Id,
                NamedDefenseTargets.Build(localization, language, row.Target),
                row.User,
                row.LastStudentMessage,
                row.TurnCount,
                row.LastActivityAt,
                row.ReadAt,
                row.UnreadTurnCount,
                row.NoteCount,
                row.HasStudentReport,
                row.HasStudentFeedback))
            .ToList();

        // Hand it back.
        return new PagedList<AdminDefenseConversationDto>(
            [.. conversations], bounds.PageNumber, bounds.PageSize, totalCount);
    }

    /// <inheritdoc/>
    public async Task<AdminDefenseFilterOptionsDto> GetFilterOptionsAsync(
        Language language, CancellationToken cancellationToken = default)
    {
        // This read's own context, since reading what the filters can be set to is a unit of work in itself.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // Everyone who has held a conversation, the busiest first. A student with none never appears. The grouped
        // rows come back anonymous and take their contract's shape afterwards, since a projection straight into
        // one doesn't survive being grouped over.
        var userRows = await ReviewableSessions(dbContext)
            .GroupBy(session => new
            {
                session.UserId,
                Username = session.User.IsDeleted ? null : session.User.Username,
                session.User.Email
            })
            .Select(group => new
            {
                group.Key.UserId,
                group.Key.Username,
                group.Key.Email,
                ConversationCount = group.Count(),
            })
            .OrderByDescending(row => row.ConversationCount)
            .ThenBy(row => row.Username)
            .ToListAsync(cancellationToken);

        // Every handout problem one has been held against, carrying the content ids the reader's side names
        // them by.
        var handoutRows = await dbContext.HandoutEnvironmentDefenses
            .AsNoTracking()
            .GroupBy(defense => new
            {
                HandoutContentId = defense.HandoutEnvironment.Handout.ContentId,
                EnvironmentId = defense.HandoutEnvironment.ContentId,
            })
            .Select(group => new
            {
                group.Key.HandoutContentId,
                group.Key.EnvironmentId,
                ConversationCount = group.Count(),
            })
            .ToListAsync(cancellationToken);

        // And every archive problem, carrying what naming it takes: nothing on the reader's side can name a
        // competition still under embargo.
        var archiveRows = await dbContext.ProblemDefenses
            .AsNoTracking()
            .GroupBy(defense => new
            {
                defense.ProblemId,
                defense.Problem.RoundId,
                defense.Problem.Slug,
                defense.Problem.Number,
                CompetitionPath = defense.Problem.Round.Competition.Path,
                defense.Problem.Round.Season.EditionNumber,
                defense.Problem.Round.Season.StartYear,
            })
            .Select(group => new
            {
                Target = new NamedDefenseTargets.Columns(
                    null,
                    null,
                    group.Key.ProblemId,
                    group.Key.RoundId,
                    group.Key.Slug,
                    group.Key.Number,
                    group.Key.CompetitionPath,
                    group.Key.EditionNumber,
                    group.Key.StartYear),
                ConversationCount = group.Count(),
            })
            .ToListAsync(cancellationToken);

        // The students, each with how many conversations they hold.
        var users = userRows
            .Select(row => new AdminDefenseUserOptionDto(
                new AdminDefenseUserDto(row.UserId, row.Username, row.Email), row.ConversationCount))
            .ToList();

        // The handout problems, each with how many conversations were held against it.
        var handoutProblems = handoutRows
            .Select(row => new AdminDefenseProblemOptionDto(
                new NamedHandoutTarget(row.HandoutContentId, row.EnvironmentId), row.ConversationCount));

        // The archive problems, each named where it comes from.
        var archiveProblems = archiveRows
            .Select(row => new AdminDefenseProblemOptionDto(
                NamedDefenseTargets.Build(localization, language, row.Target), row.ConversationCount));

        // Both kinds in one list, the busiest first, ties broken by whatever addresses the problem so that two
        // with the same count keep one order between reads.
        var problems = handoutProblems
            .Concat(archiveProblems)
            .OrderByDescending(option => option.ConversationCount)
            .ThenBy(option => NamedDefenseTargets.Key(option.Target), StringComparer.Ordinal)
            .ToList();

        // And every set of settings one has run on.
        var promptVersions = await GetPromptVersionOptionsAsync(dbContext, cancellationToken);

        // Hand back all three, since the queue needs them together the moment it opens.
        return new AdminDefenseFilterOptionsDto(users, problems, promptVersions);
    }

    /// <inheritdoc/>
    public async Task<AdminDefenseDetailDto> GetDetailAsync(
        Guid reviewerId, Guid sessionId, Language language, CancellationToken cancellationToken = default)
    {
        // This read's own context, since reading one conversation is a unit of work in itself.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // The sets the projection below reads, held apart from the context for the same reason as above.
        var notes = dbContext.AdminNotes;
        var reviews = dbContext.AdminSessionReviews;

        // The whole conversation, everything the examiner held, and what has been said about it since. Split,
        // because turns, reports and notes are three collections off one row: joined in a single query the
        // database would return every pairing of them, each repeating the statement and the settings snapshot.
        var loaded = await dbContext.DefenseSessions
            .AsNoTracking()
            .AsSplitQuery()
            .Where(session => session.Id == sessionId
                && (session.EnvironmentTarget != null || session.ProblemTarget != null))
            .Select(session => new
            {
                session.Id,
                Target = new NamedDefenseTargets.Columns(
                    session.EnvironmentTarget!.HandoutEnvironment.Handout.ContentId,
                    session.EnvironmentTarget!.HandoutEnvironment.ContentId,
                    session.ProblemTarget!.ProblemId,
                    session.ProblemTarget!.Problem.RoundId,
                    session.ProblemTarget!.Problem.Slug,
                    session.ProblemTarget!.Problem.Number,
                    session.ProblemTarget!.Problem.Round.Competition.Path,
                    session.ProblemTarget!.Problem.Round.Season.EditionNumber,
                    session.ProblemTarget!.Problem.Round.Season.StartYear),
                User = new AdminDefenseUserDto(
                    session.User.Id,
                    session.User.IsDeleted ? null : session.User.Username,
                    session.User.Email),
                session.ProblemStatement,
                session.ProblemReference,
                session.ExaminerConfig,
                Turns = session.Turns
                    .OrderBy(turn => turn.Sequence)
                    .Select(turn => new DefenseTurnDto(turn.Id, turn.Role, turn.Content, turn.CreatedAt))
                    .ToList(),
                Attempts = session.Turns
                    .SelectMany(turn => turn.Attempts)
                    .OrderBy(attempt => attempt.TurnId)
                    .ThenBy(attempt => attempt.AttemptIndex)
                    .Select(attempt => new AdminDefenseAttemptDto(
                        attempt.TurnId,
                        attempt.AttemptIndex,
                        attempt.Reply,
                        attempt.RevisionNote,
                        attempt.MathHolds,
                        attempt.MathCorrection,
                        attempt.Leaks,
                        attempt.WhatLeaked,
                        attempt.WithholdsClose,
                        attempt.Established,
                        attempt.SwitchesLanguage,
                        attempt.CandidateLanguage,
                        attempt.IsSafeFallback,
                        attempt.Calls
                            .Select(call => new AdminDefenseAttemptCallDto(
                                call.Step,
                                call.Model,
                                call.ReasoningEffort,
                                call.Cost,
                                call.PromptTokens,
                                call.CompletionTokens,
                                call.ReasoningTokens,
                                call.DurationMs))
                            .ToList(),
                        attempt.DurationMs))
                    .ToList(),
                Reports = session.Reports
                    .Select(report => new DefenseTurnReportDto(report.TurnId, report.Categories, report.Comment))
                    .ToList(),
                Feedback = session.Feedback == null
                    ? null
                    : new DefenseFeedbackDto(session.Feedback.Outcome, session.Feedback.Comment),
                Notes = notes
                    .Where(note => note.SessionId == session.Id)
                    .OrderByDescending(note => note.CreatedAt)
                    .Select(note => new AdminNoteDto(
                        note.Id,
                        note.SessionId,
                        note.TurnId,
                        new AdminDefenseUserDto(
                            note.Author.Id,
                            note.Author.IsDeleted ? null : note.Author.Username,
                            note.Author.Email),
                        note.AuthorId == reviewerId,
                        note.Content,
                        note.Category,
                        note.ResolvedAt,
                        note.CreatedAt,
                        note.UpdatedAt))
                    .ToList(),
                ReadAt = reviews
                    .Where(review => review.SessionId == session.Id && review.ReviewerId == reviewerId)
                    .Select(review => (DateTimeOffset?)review.ReadAt)
                    .FirstOrDefault(),
                session.CreatedAt,
            })
            .FirstOrDefaultAsync(cancellationToken)
            ?? throw new DefenseSessionNotFoundException();

        // Read the blob as json without committing to a shape for it, which is the whole point of storing it the
        // way it was written. Cloning detaches the element, so the document itself is done with here.
        using var examinerConfig = JsonDocument.Parse(loaded.ExaminerConfig);

        // Hand it back with the settings parsed into the response rather than double-encoded into it.
        return new AdminDefenseDetailDto(
            loaded.Id,
            NamedDefenseTargets.Build(localization, language, loaded.Target),
            loaded.User,
            loaded.ProblemStatement,
            loaded.ProblemReference,
            examinerConfig.RootElement.Clone(),
            loaded.Turns,
            loaded.Attempts,
            loaded.Reports,
            loaded.Feedback,
            loaded.Notes,
            loaded.ReadAt,
            loaded.CreatedAt);
    }

    /// <inheritdoc/>
    public async Task MarkReadAsync(
        Guid reviewerId, Guid sessionId, CancellationToken cancellationToken = default)
    {
        // This write's own context, since stamping a conversation is a unit of work in itself.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // A conversation that isn't there can't have been read.
        await AdminDefenseSessions.EnsureExistsAsync(dbContext, sessionId, cancellationToken);

        // Stamp it as read now, over whatever this reviewer's last pass left.
        await dbContext.AdminSessionReviews
            .Upsert(new AdminSessionReview
            {
                SessionId = sessionId,
                ReviewerId = reviewerId,
                ReadAt = DateTimeOffset.UtcNow,
            })
            .On(review => new { review.SessionId, review.ReviewerId })
            .RunAsync(cancellationToken);
    }

    /// <inheritdoc/>
    public async Task MarkUnreadAsync(
        Guid reviewerId, Guid sessionId, CancellationToken cancellationToken = default)
    {
        // This write's own context, since taking a stamp back is a unit of work in itself.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // Same reasoning as marking one read: there is nothing to leave unread if it isn't there.
        await AdminDefenseSessions.EnsureExistsAsync(dbContext, sessionId, cancellationToken);

        // Drop the stamp rather than blanking it, so never read and put back to unread are one state and the
        // queue only ever has the one rule to apply.
        await dbContext.AdminSessionReviews
            .Where(review => review.SessionId == sessionId && review.ReviewerId == reviewerId)
            .ExecuteDeleteAsync(cancellationToken);
    }

    /// <inheritdoc/>
    /// <remarks>
    /// The stamp lands on the turn before the one named, rather than on a moment cut just under it, so that it goes
    /// on meaning a moment somebody's reading actually stopped. Two turns recorded in the same moment can't be told
    /// apart by one, so a conversation's opening pair, saved together, moves as one.
    /// </remarks>
    public async Task MarkUnreadFromAsync(
        Guid reviewerId, Guid sessionId, Guid turnId, CancellationToken cancellationToken = default)
    {
        // This write's own context, since moving where a reader picks up is a unit of work in itself.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // There is nothing to pick up in a conversation that isn't there.
        await AdminDefenseSessions.EnsureExistsAsync(dbContext, sessionId, cancellationToken);

        // That conversation's turns. The turn to pick up from has to be one of its own, or the boundary below
        // would be read off turns it says nothing about.
        var turns = dbContext.DefenseTurns.Where(turn => turn.SessionId == sessionId);

        // How far the reading now reaches: the last turn recorded before the one to pick up from. Read in the
        // same statement as the turn itself, so a conversation carried on or rewound in between can't leave the
        // two disagreeing about which turns were there. The row stands for the turn, so a missing one reads as
        // no row while a turn nothing precedes reads as a row holding no moment.
        // A turn the conversation doesn't hold is a bad request.
        var found = await turns
            .Where(turn => turn.Id == turnId)
            .Select(turn => new
            {
                ReadAt = turns
                    .Where(earlier => earlier.CreatedAt < turn.CreatedAt)
                    .Max(earlier => (DateTimeOffset?)earlier.CreatedAt),
            })
            .FirstOrDefaultAsync(cancellationToken)
            ?? throw new AdminReviewTargetException();

        // Nothing precedes it, so the reading reaches nothing and the stamp goes the way marking one unread
        // outright drops it.
        if (found.ReadAt is not { } boundary)
        {
            // Drop it.
            await dbContext.AdminSessionReviews
                .Where(review => review.SessionId == sessionId && review.ReviewerId == reviewerId)
                .ExecuteDeleteAsync(cancellationToken);

            // Nothing left.
            return;
        }

        // Move the stamp back to it, over whatever this reviewer's last pass left.
        await dbContext.AdminSessionReviews
            .Upsert(new AdminSessionReview
            {
                SessionId = sessionId,
                ReviewerId = reviewerId,
                ReadAt = boundary,
            })
            .On(review => new { review.SessionId, review.ReviewerId })
            .RunAsync(cancellationToken);
    }

    /// <inheritdoc/>
    public async Task MarkManyAsync(
        Guid reviewerId,
        IReadOnlyCollection<Guid> sessionIds,
        bool read,
        CancellationToken cancellationToken = default)
    {
        // The same conversation named twice is one conversation, and it would be one row either way.
        var distinctIds = sessionIds.Distinct().ToList();

        // A set naming nothing has nothing to write.
        if (distinctIds.Count == 0)
            return;

        // This write's own context, since marking a set is a unit of work in itself.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // Taking the stamps back reaches only rows this reviewer already has, so an id naming no conversation
        // matches nothing and needs no checking first.
        if (!read)
        {
            // Drop them, for the same reason marking one unread drops rather than blanks.
            await dbContext.AdminSessionReviews
                .Where(review => distinctIds.Contains(review.SessionId) && review.ReviewerId == reviewerId)
                .ExecuteDeleteAsync(cancellationToken);

            // Nothing left.
            return;
        }

        // Which of them the database still holds, since a stamp is keyed to a conversation and one gone since
        // the queue was read would take the whole set down with it.
        var knownIds = await dbContext.DefenseSessions
            .Where(session => distinctIds.Contains(session.Id))
            .Select(session => session.Id)
            .ToListAsync(cancellationToken);

        // Every one of them is gone, so there is nothing left to stamp.
        if (knownIds.Count == 0)
            return;

        // One moment for the set, so a whole backlog cleared in one go reads as one pass rather than as a
        // spread of stamps a later boundary check would tell apart.
        var readAt = DateTimeOffset.UtcNow;

        // Stamp them all, over whatever this reviewer's last pass left on any of them.
        await dbContext.AdminSessionReviews
            .UpsertRange(knownIds.Select(sessionId => new AdminSessionReview
            {
                SessionId = sessionId,
                ReviewerId = reviewerId,
                ReadAt = readAt,
            }))
            .On(review => new { review.SessionId, review.ReviewerId })
            .RunAsync(cancellationToken);
    }

    /// <summary>
    /// The conversations the review surface reads: every one held against something. A conversation whose
    /// target row never landed names no problem, so nothing here can say what it was about.
    /// </summary>
    /// <param name="dbContext">The context the query is built against.</param>
    /// <returns>The conversations, still unrun.</returns>
    private static IQueryable<DefenseSession> ReviewableSessions(MathCompsDbContext dbContext) =>
        dbContext.DefenseSessions
            .AsNoTracking()
            .Where(session => session.EnvironmentTarget != null || session.ProblemTarget != null);

    /// <summary>
    /// Narrows the conversations to those the database can pick out from what is stored against them, which is
    /// every filter except the two over when a conversation last moved and when it was last read. Those two are
    /// stored nowhere and so are applied further along, once both values have been worked out.
    /// </summary>
    /// <param name="dbContext">The context the query is built against.</param>
    /// <param name="filter">Which conversations to keep.</param>
    /// <returns>The conversations these filters leave.</returns>
    private static IQueryable<DefenseSession> ApplySessionFilters(
        MathCompsDbContext dbContext, AdminDefenseQueueFilter filter)
    {
        // Conversations held against a problem, of either kind.
        var sessions = ReviewableSessions(dbContext);

        // Whose conversations to read.
        if (filter.UserId is { } userId)
            sessions = sessions.Where(session => session.UserId == userId);

        // Which handout they were held against.
        if (filter.HandoutContentId is { } handoutContentId)
            sessions = sessions.Where(session =>
                session.EnvironmentTarget!.HandoutEnvironment.Handout.ContentId == handoutContentId);

        // And which problem within it, whose id only means anything alongside its handout's.
        if (filter.EnvironmentId is { } environmentId)
            sessions = sessions.Where(session =>
                session.EnvironmentTarget!.HandoutEnvironment.ContentId == environmentId);

        // Or which archive problem, which one id addresses on its own.
        if (filter.ProblemSlug is { } problemSlug)
            sessions = sessions.Where(session => session.ProblemTarget!.Problem.Slug == problemSlug);

        // Conversations somebody has written about, or the ones nobody has.
        if (filter.HasNotes is { } hasNotes)
            sessions = hasNotes
                ? sessions.Where(session => dbContext.AdminNotes.Any(note => note.SessionId == session.Id))
                : sessions.Where(session => !dbContext.AdminNotes.Any(note => note.SessionId == session.Id));

        // Conversations where the student called out a reply.
        if (filter.StudentReported)
            sessions = sessions.Where(session => session.Reports.Any());

        // Conversations the student said something about.
        if (filter.StudentFeedback)
            sessions = sessions.Where(session => session.Feedback != null);

        // Conversations run on one set of examiner settings.
        if (filter.PromptVersion is { } promptVersion)
            sessions = sessions.Where(session =>
                PostgresDbFunctions.ExaminerConfigVersion(session.ExaminerConfig) == promptVersion);

        // Hand back the query, still unrun, for the projection that reads it.
        return sessions;
    }

    /// <summary>
    /// Reads every set of examiner settings a conversation has run on, keyed by the version the database hashes
    /// out of the snapshot, so grouping here and filtering to one set are the same expression.
    /// </summary>
    /// <param name="dbContext">The context the query is built against.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>The settings, most recently used first.</returns>
    private static async Task<IReadOnlyList<AdminDefensePromptVersionOptionDto>> GetPromptVersionOptionsAsync(
        MathCompsDbContext dbContext, CancellationToken cancellationToken)
    {
        // Group the conversations by their settings and measure each group's span. The rows come back anonymous
        // and take their contract's shape afterwards, since a projection straight into one doesn't survive being
        // grouped over.
        var rows = await ReviewableSessions(dbContext)
            .GroupBy(session => PostgresDbFunctions.ExaminerConfigVersion(session.ExaminerConfig))
            .Select(group => new
            {
                Version = group.Key,
                FirstSeenAt = group.Min(session => session.CreatedAt),
                LastSeenAt = group.Max(session => session.CreatedAt),
                ConversationCount = group.Count(),
            })
            .OrderByDescending(row => row.LastSeenAt)
            .ToListAsync(cancellationToken);

        // Each set of settings, with its span and how many conversations ran on it.
        return [.. rows.Select(row => new AdminDefensePromptVersionOptionDto(
            row.Version, row.FirstSeenAt, row.LastSeenAt, row.ConversationCount))];
    }

    /// <summary>
    /// One conversation as the page comes back, its problem still as the columns naming it.
    /// </summary>
    /// <param name="Id"><inheritdoc cref="AdminDefenseConversationDto.Id" path="/summary"/></param>
    /// <param name="Target"><inheritdoc cref="NamedDefenseTargets.Columns" path="/summary"/></param>
    /// <param name="User"><inheritdoc cref="AdminDefenseUserDto" path="/summary"/></param>
    /// <param name="LastStudentMessage"><inheritdoc cref="AdminDefenseConversationDto.LastStudentMessage" path="/summary"/></param>
    /// <param name="TurnCount"><inheritdoc cref="AdminDefenseConversationDto.TurnCount" path="/summary"/></param>
    /// <param name="LastActivityAt"><inheritdoc cref="AdminDefenseConversationDto.LastActivityAt" path="/summary"/></param>
    /// <param name="ReadAt"><inheritdoc cref="AdminDefenseConversationDto.ReadAt" path="/summary"/></param>
    /// <param name="UnreadTurnCount"><inheritdoc cref="AdminDefenseConversationDto.UnreadTurnCount" path="/summary"/></param>
    /// <param name="NoteCount"><inheritdoc cref="AdminDefenseConversationDto.NoteCount" path="/summary"/></param>
    /// <param name="HasStudentReport"><inheritdoc cref="AdminDefenseConversationDto.HasStudentReport" path="/summary"/></param>
    /// <param name="HasStudentFeedback"><inheritdoc cref="AdminDefenseConversationDto.HasStudentFeedback" path="/summary"/></param>
    private sealed record QueueRow(
        Guid Id,
        NamedDefenseTargets.Columns Target,
        AdminDefenseUserDto User,
        string? LastStudentMessage,
        int TurnCount,
        DateTimeOffset LastActivityAt,
        DateTimeOffset? ReadAt,
        int UnreadTurnCount,
        int NoteCount,
        bool HasStudentReport,
        bool HasStudentFeedback);
}

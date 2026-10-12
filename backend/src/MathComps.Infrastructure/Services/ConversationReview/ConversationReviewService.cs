using System.Text.Json;
using MathComps.Domain.Contracts.ConversationReview;
using MathComps.Domain.Contracts.Defense;
using MathComps.Domain.Contracts.Users;
using MathComps.Domain.EfCoreEntities;
using MathComps.Domain.Localization;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Defense;
using MathComps.Infrastructure.Services.Localization;
using Microsoft.EntityFrameworkCore;

namespace MathComps.Infrastructure.Services.ConversationReview;

/// <summary>
/// Implements <see cref="IConversationReviewService"/> over the database.
/// </summary>
/// <param name="dbContextFactory">The factory minting each operation's database context.</param>
/// <param name="localization">The resolver of localized display names.</param>
public class ConversationReviewService(
    IDbContextFactory<MathCompsDbContext> dbContextFactory,
    IMetadataLocalizationService localization)
    : IConversationReviewService
{
    /// <inheritdoc/>
    public async Task<ConversationDetailDto> GetDetailAsync(
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
                    session.ProblemTarget!.Problem.Slug,
                    session.ProblemTarget!.Problem.Number,
                    session.ProblemTarget!.Problem.Round.Competition.Path,
                    session.ProblemTarget!.Problem.Round.Season.EditionNumber,
                    session.ProblemTarget!.Problem.Round.Season.StartYear),
                User = new UserIdentityDto(
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
                    .Select(attempt => new DefenseTurnAttemptDto(
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
                        attempt.GendersTheReader,
                        attempt.TakesOver,
                        attempt.CandidateWork,
                        attempt.RestatedReferenceStep,
                        attempt.IsSafeFallback,
                        attempt.Calls
                            .Select(call => new DefenseAttemptCallDto(
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
                    .Select(note => new ReviewNoteDto(
                        note.Id,
                        note.SessionId,
                        note.TurnId,
                        new UserIdentityDto(
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

        // The proposal the conversation's problem is, if it is one.
        var proposals = await NamedDefenseTargets.LoadProposalsAsync(dbContext, [loaded.Target], cancellationToken);

        // Read the blob as json without committing to a shape for it, which is the whole point of storing it the
        // way it was written. Cloning detaches the element, so the document itself is done with here.
        using var examinerConfig = JsonDocument.Parse(loaded.ExaminerConfig);

        // Hand it back with the settings parsed into the response rather than double-encoded into it.
        return new ConversationDetailDto(
            loaded.Id,
            NamedDefenseTargets.Build(localization, language, loaded.Target, proposals),
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
        await ConversationReviewSessions.EnsureExistsAsync(dbContext, sessionId, cancellationToken);

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
        await ConversationReviewSessions.EnsureExistsAsync(dbContext, sessionId, cancellationToken);

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
        await ConversationReviewSessions.EnsureExistsAsync(dbContext, sessionId, cancellationToken);

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
            ?? throw new ReviewTargetException();

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
}

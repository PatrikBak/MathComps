using MathComps.Domain.Contracts.Admin;
using MathComps.Domain.Contracts.ConversationReview;
using MathComps.Domain.Contracts.Helpers;
using MathComps.Domain.Contracts.Users;
using MathComps.Domain.Localization;
using MathComps.Infrastructure.Options;
using MathComps.Infrastructure.Pagination;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Defense;
using MathComps.Infrastructure.Services.Localization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace MathComps.Infrastructure.Services.Admin;

/// <summary>
/// Implements <see cref="IAdminNoteService"/> over the database.
/// </summary>
/// <param name="dbContextFactory">The factory minting each operation's database context.</param>
/// <param name="paginationOptions">The bounds a page of the feed is cut by.</param>
/// <param name="localization">The resolver of localized display names.</param>
public class AdminNoteService(
    IDbContextFactory<MathCompsDbContext> dbContextFactory,
    IOptions<PaginationOptions> paginationOptions,
    IMetadataLocalizationService localization) : IAdminNoteService
{
    /// <inheritdoc/>
    public async Task<PagedList<AdminNoteFeedItemDto>> GetFeedAsync(
        Guid reviewerId,
        bool openOnly,
        int pageNumber,
        Language language,
        CancellationToken cancellationToken = default)
    {
        // The page as it will be served, which is how much of the feed one request can ask for.
        var bounds = PageBounds.ForServerPage(paginationOptions.Value, pageNumber);

        // This read's own context, since reading the feed is a unit of work in itself.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // Every note, save the ones whose conversation has lost its problem: the queue and the conversation
        // itself both require one, so surfacing it here would offer a way into a conversation that can't be
        // opened.
        var notes = dbContext.AdminNotes
            .AsNoTracking()
            .Where(note =>
                note.Session.EnvironmentTarget != null || note.Session.ProblemTarget != null);

        // Leave out what has already been settled.
        if (openOnly)
            notes = notes.Where(note => note.ResolvedAt == null);

        // How many there are in all, for the pager.
        var totalCount = await notes.CountAsync(cancellationToken);

        // The page itself, newest first, each note carrying where it was written.
        var rows = await notes
            .OrderByDescending(note => note.CreatedAt)
            // A tie goes to the note written later: ids are time-ordered v7 Guids.
            .ThenByDescending(note => note.Id)
            .Skip(bounds.Skip)
            .Take(bounds.PageSize)
            .Select(note => new FeedRow(
                new ReviewNoteDto(
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
                    note.UpdatedAt),
                new NamedDefenseTargets.Columns(
                    note.Session.EnvironmentTarget!.HandoutEnvironment.Handout.ContentId,
                    note.Session.EnvironmentTarget!.HandoutEnvironment.ContentId,
                    note.Session.ProblemTarget!.ProblemId,
                    note.Session.ProblemTarget!.Problem.Slug,
                    note.Session.ProblemTarget!.Problem.Number,
                    note.Session.ProblemTarget!.Problem.Round.Competition.Path,
                    note.Session.ProblemTarget!.Problem.Round.Season.EditionNumber,
                    note.Session.ProblemTarget!.Problem.Round.Season.StartYear),
                new UserIdentityDto(
                    note.Session.User.Id,
                    note.Session.User.IsDeleted ? null : note.Session.User.Username,
                    note.Session.User.Email),
                // Where a turn-level note hangs.
                note.Turn == null ? null : note.Turn.Sequence))
            .ToListAsync(cancellationToken);

        // The proposals among the page's problems.
        var proposals = await NamedDefenseTargets.LoadProposalsAsync(
            dbContext, rows.Select(row => row.Target), cancellationToken);

        // Each note with its conversation's problem named, which takes the taxonomy the database knows nothing of.
        var items = rows
            .Select(row => new AdminNoteFeedItemDto(
                row.Note,
                NamedDefenseTargets.Build(localization, language, row.Target, proposals),
                row.User,
                row.TurnSequence))
            .ToList();

        // Hand back the page.
        return new PagedList<AdminNoteFeedItemDto>(
            [.. items], bounds.PageNumber, bounds.PageSize, totalCount);
    }

    /// <summary>
    /// One note as the page comes back, its conversation's problem still as the columns naming it.
    /// </summary>
    /// <param name="Note"><inheritdoc cref="ReviewNoteDto" path="/summary"/></param>
    /// <param name="Target"><inheritdoc cref="NamedDefenseTargets.Columns" path="/summary"/></param>
    /// <param name="User"><inheritdoc cref="AdminNoteFeedItemDto.User" path="/summary"/></param>
    /// <param name="TurnSequence"><inheritdoc cref="AdminNoteFeedItemDto.TurnSequence" path="/summary"/></param>
    private sealed record FeedRow(
        ReviewNoteDto Note,
        NamedDefenseTargets.Columns Target,
        UserIdentityDto User,
        int? TurnSequence);
}

using MathComps.Domain.Contracts.Admin;
using MathComps.Domain.Contracts.Helpers;
using MathComps.Domain.EfCoreEntities;
using MathComps.Domain.Localization;
using MathComps.Infrastructure.Options;
using MathComps.Infrastructure.Services.Localization;
using MathComps.Infrastructure.Pagination;
using MathComps.Infrastructure.Persistence;
using MathComps.Shared.Extensions;
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
    /// <summary>
    /// The most text one note may carry, set far above anything a reviewer writes. The body rides back in full
    /// with every read of the conversation and every page of the feed, which is what the ceiling is for.
    /// </summary>
    private const int MaxNoteChars = 20_000;

    /// <summary>
    /// Reduces what a note says to the text it carries, refusing a body that says nothing or says more than a
    /// note is allowed to.
    /// </summary>
    /// <param name="content">What the note says, as it was sent.</param>
    /// <returns>The text it carries.</returns>
    private static string NormalizeContent(string content)
    {
        // Carrying no text says nothing, which is a bad request rather than a quiet row.
        var normalizedContent = content.TrimToNull() ?? throw new AdminNoteValueException();

        // Past the ceiling is a body nothing on this surface authored.
        if (normalizedContent.Length > MaxNoteChars)
            throw new AdminNoteValueException();

        // What the note carries.
        return normalizedContent;
    }

    /// <inheritdoc/>
    public async Task<AdminNoteDto> CreateAsync(
        Guid authorId,
        Guid sessionId,
        Guid? turnId,
        string content,
        DefenseReportCategory? category,
        CancellationToken cancellationToken = default)
    {
        // What it says, reduced to the text it carries.
        var normalizedContent = NormalizeContent(content);

        // A failure the contract doesn't name is a bad request, and refusing it here is what keeps it from
        // reaching a column that has no label for it.
        if (category is { } named && !Enum.IsDefined(named))
            throw new AdminNoteValueException();

        // This operation's own context, since writing a note is a unit of work in itself.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // The conversation has to be there to be written about.
        await AdminDefenseSessions.EnsureExistsAsync(dbContext, sessionId, cancellationToken);

        // A note against a reply has to be against one of that conversation's own. The key behind the column
        // settles it too, but reaching it would surface as a server fault rather than the bad request it is.
        if (turnId is { } againstTurn
            && !await dbContext.DefenseTurns.AnyAsync(
                turn => turn.SessionId == sessionId && turn.Id == againstTurn, cancellationToken))
            throw new AdminNoteTargetException();

        // Who is writing it, read now so the note can carry them back. The id came from resolving the caller,
        // so nobody behind it is a broken invariant, not a bad request.
        var author = await ReadUserAsync(dbContext, authorId, cancellationToken)
            ?? throw new InvalidOperationException($"Author with id '{authorId}' not found");

        // One timestamp, so a note just written reads as never revised.
        var writtenAt = DateTimeOffset.UtcNow;

        // The note itself.
        var note = new AdminNote
        {
            AuthorId = authorId,
            SessionId = sessionId,
            TurnId = turnId,
            Content = normalizedContent,
            Category = category,
            ResolvedAt = null,
            CreatedAt = writtenAt,
            UpdatedAt = writtenAt,
        };

        // Track it.
        dbContext.AdminNotes.Add(note);

        // And write it.
        await dbContext.SaveChangesAsync(cancellationToken);

        // Hand back what was written, so the caller needn't ask for it.
        return new AdminNoteDto(
            note.Id,
            note.SessionId,
            note.TurnId,
            author,
            // Whoever wrote it is the one being handed it back.
            true,
            note.Content,
            note.Category,
            note.ResolvedAt,
            note.CreatedAt,
            note.UpdatedAt);
    }

    /// <inheritdoc/>
    public async Task<AdminNoteDto> UpdateAsync(
        Guid reviewerId,
        Guid noteId,
        string content,
        DefenseReportCategory? category,
        CancellationToken cancellationToken = default)
    {
        // What it should now say. Revising a note into carrying no text leaves an empty row, not a quiet one.
        var normalizedContent = NormalizeContent(content);

        // Same as writing one: a failure the contract doesn't name can't reach the column.
        if (category is { } named && !Enum.IsDefined(named))
            throw new AdminNoteValueException();

        // This operation's own context, since revising a note is a unit of work in itself.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // The note being revised, carrying whoever wrote it, since the revision goes back to the caller
        // naming them.
        var note = await dbContext.AdminNotes
            .Include(stored => stored.Author)
            .FirstOrDefaultAsync(stored => stored.Id == noteId, cancellationToken)
            ?? throw new AdminNoteNotFoundException();

        // Somebody else's reading of the conversation is not this reviewer's to rewrite, and the byline would
        // go on naming them.
        if (note.AuthorId != reviewerId)
            throw new NotAdminNoteAuthorException();

        // Replace what it says rather than adding to it: the call stands for the note's whole new state, so
        // leaving the category out is how it gets cleared.
        note.Content = normalizedContent;
        note.Category = category;
        note.UpdatedAt = DateTimeOffset.UtcNow;

        // Write the revision.
        await dbContext.SaveChangesAsync(cancellationToken);

        // Hand back the note as it now stands.
        return new AdminNoteDto(
            note.Id,
            note.SessionId,
            note.TurnId,
            new AdminDefenseUserDto(
                note.Author.Id, note.Author.IsDeleted ? null : note.Author.Username, note.Author.Email),
            // The gate above leaves only the author here.
            true,
            note.Content,
            note.Category,
            note.ResolvedAt,
            note.CreatedAt,
            note.UpdatedAt);
    }

    /// <inheritdoc/>
    public async Task DeleteAsync(
        Guid reviewerId, Guid noteId, CancellationToken cancellationToken = default)
    {
        // This operation's own context, since dropping a note is a unit of work in itself.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // Drop it, but only the caller's own. Both facts ride in one statement so the ordinary case costs one
        // round trip; telling the two refusals apart below is what pays for the second.
        var deleted = await dbContext.AdminNotes
            .Where(note => note.Id == noteId && note.AuthorId == reviewerId)
            .ExecuteDeleteAsync(cancellationToken);

        // Dropped, so there is nothing left to explain.
        if (deleted > 0)
            return;

        // Nothing dropped means either no such note or somebody else's, which are different answers: one is
        // a stale id, the other a refusal the caller can act on.
        if (await dbContext.AdminNotes.AnyAsync(note => note.Id == noteId, cancellationToken))
            throw new NotAdminNoteAuthorException();

        // Otherwise there is nothing under the id.
        throw new AdminNoteNotFoundException();
    }

    /// <inheritdoc/>
    public async Task SetResolvedAsync(
        Guid noteId, bool resolved, CancellationToken cancellationToken = default)
    {
        // When it was settled, or nothing at all once it is put back to standing.
        var resolvedAt = resolved ? DateTimeOffset.UtcNow : (DateTimeOffset?)null;

        // This operation's own context, since marking a note is a unit of work in itself.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // Mark the one note under the id. Only the settling stamp moves: what the note says is untouched, and
        // bumping the revision stamp here would leave every settled note reading as one somebody rewrote.
        var updated = await dbContext.AdminNotes
            .Where(note => note.Id == noteId)
            .ExecuteUpdateAsync(
                setters => setters.SetProperty(note => note.ResolvedAt, resolvedAt),
                cancellationToken);

        // Nothing marked means there was no such note.
        if (updated == 0)
            throw new AdminNoteNotFoundException();
    }

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
                new AdminNoteDto(
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
                    note.UpdatedAt),
                new AdminDefenseTargets.Columns(
                    note.Session.EnvironmentTarget!.HandoutEnvironment.Handout.ContentId,
                    note.Session.EnvironmentTarget!.HandoutEnvironment.ContentId,
                    note.Session.ProblemTarget!.Problem.Slug,
                    note.Session.ProblemTarget!.Problem.Number,
                    note.Session.ProblemTarget!.Problem.Round.Competition.Path,
                    note.Session.ProblemTarget!.Problem.Round.Season.EditionNumber,
                    note.Session.ProblemTarget!.Problem.Round.Season.StartYear),
                new AdminDefenseUserDto(
                    note.Session.User.Id,
                    note.Session.User.IsDeleted ? null : note.Session.User.Username,
                    note.Session.User.Email),
                // Where a turn-level note hangs.
                note.Turn == null ? null : note.Turn.Sequence))
            .ToListAsync(cancellationToken);

        // Each note with its conversation's problem named, which takes the taxonomy the database knows nothing of.
        var items = rows
            .Select(row => new AdminNoteFeedItemDto(
                row.Note,
                AdminDefenseTargets.Build(localization, language, row.Target),
                row.User,
                row.TurnSequence))
            .ToList();

        // Hand back the page.
        return new PagedList<AdminNoteFeedItemDto>(
            [.. items], bounds.PageNumber, bounds.PageSize, totalCount);
    }

    /// <summary>
    /// Reads the one person under an id, cut down to what a note's byline carries.
    /// </summary>
    /// <param name="dbContext">The context the query is built against.</param>
    /// <param name="userId">Who to read.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>Them, or null when there is nobody under the id.</returns>
    private static Task<AdminDefenseUserDto?> ReadUserAsync(
        MathCompsDbContext dbContext, Guid userId, CancellationToken cancellationToken)
    {
        // Whoever sits under the id, and only the three fields a byline is made of.
        return dbContext.Users
            .Where(user => user.Id == userId)
            .Select(user => new AdminDefenseUserDto(
                user.Id, user.IsDeleted ? null : user.Username, user.Email))
            .FirstOrDefaultAsync(cancellationToken);
    }

    /// <summary>
    /// One note as the page comes back, its conversation's problem still as the columns naming it.
    /// </summary>
    /// <param name="Note"><inheritdoc cref="AdminNoteDto" path="/summary"/></param>
    /// <param name="Target"><inheritdoc cref="AdminDefenseTargets.Columns" path="/summary"/></param>
    /// <param name="User"><inheritdoc cref="AdminDefenseUserDto" path="/summary"/></param>
    /// <param name="TurnSequence"><inheritdoc cref="AdminNoteFeedItemDto.TurnSequence" path="/summary"/></param>
    private sealed record FeedRow(
        AdminNoteDto Note,
        AdminDefenseTargets.Columns Target,
        AdminDefenseUserDto User,
        int? TurnSequence);
}

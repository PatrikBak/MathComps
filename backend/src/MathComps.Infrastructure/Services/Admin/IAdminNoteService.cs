using MathComps.Domain.Contracts.Admin;
using MathComps.Domain.Contracts.Helpers;
using MathComps.Domain.EfCoreEntities;
using MathComps.Domain.Localization;

namespace MathComps.Infrastructure.Services.Admin;

/// <summary>
/// Keeps what gets written down while reviewing defense conversations. A note stands against one reply or against
/// a whole conversation, and notes accumulate rather than replace each other, since a reply can be wrong in more
/// than one way and each is worth saying separately.
/// </summary>
public interface IAdminNoteService
{
    /// <summary>
    /// Writes a note about a conversation, optionally against one of its replies.
    /// </summary>
    /// <param name="authorId">The reviewer writing it.</param>
    /// <param name="sessionId">The conversation the note is about.</param>
    /// <param name="turnId">The reply it stands against, or null for the conversation as a whole.</param>
    /// <param name="content">What it says.</param>
    /// <param name="category">Which failure it names, or null to name none.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>The note as written.</returns>
    Task<AdminNoteDto> CreateAsync(
        Guid authorId,
        Guid sessionId,
        Guid? turnId,
        string content,
        DefenseReportCategory? category,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Revises a note, replacing both what it says and which failure it names. Only the reviewer who wrote it
    /// may: the note is their reading of the conversation, and it goes on carrying their name.
    /// </summary>
    /// <param name="reviewerId">The reviewer revising it.</param>
    /// <param name="noteId">The note to revise.</param>
    /// <param name="content">What it should now say.</param>
    /// <param name="category">Which failure it should now name, or null to name none.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>The note as revised.</returns>
    Task<AdminNoteDto> UpdateAsync(
        Guid reviewerId,
        Guid noteId,
        string content,
        DefenseReportCategory? category,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Drops a note. Only the reviewer who wrote it may, since dropping one is not reversible.
    /// </summary>
    /// <param name="reviewerId">The reviewer dropping it.</param>
    /// <param name="noteId">The note to drop.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    Task DeleteAsync(Guid reviewerId, Guid noteId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Marks a note settled, or puts it back to standing. A settled note keeps its place and its example; only
    /// whether it still counts as an open problem changes. Any reviewer may, since settling one is a judgement
    /// about the conversation rather than a change to what somebody wrote, and it is reversible.
    /// </summary>
    /// <param name="noteId">The note to mark.</param>
    /// <param name="resolved">True to settle it, false to put it back to standing.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    Task SetResolvedAsync(Guid noteId, bool resolved, CancellationToken cancellationToken = default);

    /// <summary>
    /// Reads notes across every conversation, newest first, so what has been concluded can be read without
    /// opening the conversations it was concluded in.
    /// </summary>
    /// <param name="reviewerId">The reviewer reading it, whose own notes come back marked as theirs.</param>
    /// <param name="openOnly">Whether to leave out the notes already settled.</param>
    /// <param name="pageNumber">1-based page index to retrieve; values outside the range are clamped.</param>
    /// <param name="language">The language to name each note's problem in.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>The page of notes, each with enough of where it was written to be read on its own.</returns>
    Task<PagedList<AdminNoteFeedItemDto>> GetFeedAsync(
        Guid reviewerId,
        bool openOnly,
        int pageNumber,
        Language language,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// Thrown when a note carries a value the contract can't take: no text at all, more text than a note may carry,
/// or a category outside the ones <see cref="DefenseReportCategory"/> defines.
/// </summary>
public sealed class AdminNoteValueException() : Exception("The note is not valid");

/// <summary>
/// Thrown when a note stands against a reply the conversation it is about doesn't hold.
/// </summary>
public sealed class AdminNoteTargetException() : Exception("The noted reply is not valid");

/// <summary>
/// Thrown when no note exists under the id.
/// </summary>
public sealed class AdminNoteNotFoundException() : Exception("The note was not found");

/// <summary>
/// Thrown when a reviewer tries to revise or drop a note somebody else wrote. A note is that reviewer's own
/// reading of a conversation, and a second one rewriting it would leave the byline naming the wrong person.
/// </summary>
public sealed class NotAdminNoteAuthorException() : Exception("The note was written by somebody else");

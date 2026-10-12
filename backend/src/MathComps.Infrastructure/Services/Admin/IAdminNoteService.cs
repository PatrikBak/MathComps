using MathComps.Domain.Contracts.Admin;
using MathComps.Domain.Contracts.Helpers;
using MathComps.Domain.Localization;

namespace MathComps.Infrastructure.Services.Admin;

/// <summary>
/// Reads the notes written while reviewing defense conversations as one feed across all of them.
/// </summary>
public interface IAdminNoteService
{
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


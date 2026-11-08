using MathComps.Domain.Contracts.Defense;
using MathComps.Infrastructure.Options;
using Microsoft.Extensions.Options;

namespace MathComps.Infrastructure.Services.Defense;

/// <summary>
/// Implements <see cref="IDefenseLimitsProvider"/> from the defense caps and the photo reader's settings, gathered
/// once, since neither is read again after startup.
/// </summary>
/// <param name="defenseLimits">The caps on a defense.</param>
/// <param name="photoReaderSettings">How a photo of the student's work is read, down to the size it is read at.</param>
public class DefenseLimitsProvider(
    IOptions<DefenseLimits> defenseLimits,
    IOptions<PhotoReaderSettings> photoReaderSettings)
    : IDefenseLimitsProvider
{
    /// <inheritdoc/>
    public DefenseLimitsDto Limits { get; } = new(
        defenseLimits.Value.MaxCandidateChars,
        defenseLimits.Value.MaxFeedbackCommentChars,
        defenseLimits.Value.MaxMessagesPerDefense,
        defenseLimits.Value.MaxPhotosPerMessage,
        photoReaderSettings.Value.LongEdge);
}

using MathComps.Domain.Contracts.Defense;
using MathComps.Infrastructure.Options;
using Microsoft.Extensions.Options;

namespace MathComps.Infrastructure.Services.Defense;

/// <summary>
/// Implements <see cref="IDefenseLimitsProvider"/> from the defense caps, gathered once, since they are not read
/// again after startup.
/// </summary>
/// <param name="defenseLimits">The caps on a defense.</param>
public class DefenseLimitsProvider(IOptions<DefenseLimits> defenseLimits) : IDefenseLimitsProvider
{
    /// <inheritdoc/>
    public DefenseLimitsDto Limits { get; } = new(
        defenseLimits.Value.MaxCandidateChars,
        defenseLimits.Value.MaxFeedbackCommentChars,
        defenseLimits.Value.MaxMessagesPerDefense,
        defenseLimits.Value.MaxPhotosPerMessage);
}

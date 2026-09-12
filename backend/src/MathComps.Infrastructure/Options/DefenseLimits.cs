using System.ComponentModel.DataAnnotations;
using MathComps.Domain.Contracts.Defense;
using MathComps.Domain.EfCoreEntities;

namespace MathComps.Infrastructure.Options;

/// <summary>
/// Caps on a defense: how long a student's message may be, how long their feedback comment may be, how many
/// messages the student may send in one conversation, and how much one user may spend in a day. The range
/// annotations make a missing or zeroed section fail validation at startup rather than silently rejecting every
/// message (a zero ceiling refuses everything).
/// </summary>
public class DefenseLimits
{
    /// <summary>
    /// Configuration section name for these settings.
    /// </summary>
    public const string SectionName = "DefenseLimits";

    /// <inheritdoc cref="DefenseLimitsDto.MaxCandidateChars" path="/summary"/>
    [Range(1, int.MaxValue)]
    public required int MaxCandidateChars { get; set; }

    /// <inheritdoc cref="DefenseLimitsDto.MaxFeedbackCommentChars" path="/summary"/>
    [Range(1, int.MaxValue)]
    public required int MaxFeedbackCommentChars { get; set; }

    /// <inheritdoc cref="DefenseLimitsDto.MaxMessagesPerDefense" path="/summary"/>
    [Range(1, int.MaxValue)]
    public required int MaxMessagesPerDefense { get; set; }

    /// <summary>
    /// The most a single user may spend on defense turns per day (since UTC midnight), in credits (US dollars).
    /// Only spend that <see cref="DefenseSpend.CountsAgainstCeiling"/> marks is weighed against it.
    /// </summary>
    // The bounds are written with a dot, so they have to be read with one: left to the host's culture they
    // fail to parse wherever the decimal separator differs, taking the whole startup down with them
    [Range(typeof(decimal), "0.01", "1000000", ParseLimitsInInvariantCulture = true)]
    public required decimal DailySpendCeilingPerUser { get; set; }
}

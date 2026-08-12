using System.ComponentModel.DataAnnotations;
using MathComps.Domain.Contracts.Defense;

namespace MathComps.Infrastructure.Options;

/// <summary>
/// Caps on a defense: how large its inputs may be, how many turns a conversation may grow to, how long a
/// student's feedback comment may be, and how much one user may spend in a day. The range annotations make a
/// missing or zeroed section fail validation
/// at startup rather than silently rejecting every turn (a zero ceiling refuses everything).
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

    /// <summary>
    /// The longest a handout's content id may be, in characters. Kept in step with the anchor column it is
    /// stored in, so an over-long id is refused as a bad request rather than failing the write.
    /// </summary>
    [Range(1, int.MaxValue)]
    public required int MaxHandoutContentIdChars { get; set; }

    /// <summary>
    /// The longest an environment's id may be, in characters. Bounded the same way as
    /// <see cref="MaxHandoutContentIdChars"/>.
    /// </summary>
    [Range(1, int.MaxValue)]
    public required int MaxEnvironmentIdChars { get; set; }

    /// <inheritdoc cref="DefenseLimitsDto.MaxFeedbackCommentChars" path="/summary"/>
    [Range(1, int.MaxValue)]
    public required int MaxFeedbackCommentChars { get; set; }

    /// <inheritdoc cref="DefenseLimitsDto.MaxTurnsPerSession" path="/summary"/>
    [Range(1, int.MaxValue)]
    public required int MaxTurnsPerSession { get; set; }

    /// <summary>
    /// The most a single user may spend on defense turns per day (since UTC midnight), in credits (US dollars).
    /// </summary>
    // The bounds are written with a dot, so they have to be read with one: left to the host's culture they
    // fail to parse wherever the decimal separator differs, taking the whole startup down with them
    [Range(typeof(decimal), "0.01", "1000000", ParseLimitsInInvariantCulture = true)]
    public required decimal DailySpendCeilingPerUser { get; set; }
}

using System.ComponentModel.DataAnnotations;

namespace MathComps.Infrastructure.Options;

/// <summary>
/// Settings for handing a student's phone photos over to a defense composer open on another device. The annotation
/// makes a missing <c>DefensePhotoHandoff</c> section fail validation at startup.
/// </summary>
public class DefensePhotoHandoffSettings
{
    /// <summary>
    /// Configuration section name for these settings.
    /// </summary>
    public const string SectionName = "DefensePhotoHandoff";

    /// <summary>
    /// How long a handoff code works from when it is made.
    /// </summary>
    [Range(typeof(TimeSpan), "00:01:00", "7.00:00:00", ParseLimitsInInvariantCulture = true)]
    public required TimeSpan CodeLifetime { get; set; }
}

using System.ComponentModel.DataAnnotations;

namespace MathComps.Infrastructure.Options;

/// <summary>
/// When the mail about new messages in grade conversations is put together: how often the API looks, how long
/// somebody's news has to go quiet first, and how far apart two of their mails have to be.
/// </summary>
public class GradeMessageMailSettings : PollingSettings
{
    /// <summary>
    /// Configuration section name for these settings.
    /// </summary>
    public const string SectionName = "GradeMessageMail";

    /// <summary>
    /// How long nothing new has to arrive for a recipient before their mail is put together.
    /// </summary>
    [Range(typeof(TimeSpan), "00:00:01", "1.00:00:00", ParseLimitsInInvariantCulture = true)]
    public TimeSpan QuietPeriod { get; set; }

    /// <summary>
    /// The least time between two mails to one person. What arrives for them meanwhile waits for the next mail.
    /// </summary>
    [Range(typeof(TimeSpan), "00:00:01", "7.00:00:00", ParseLimitsInInvariantCulture = true)]
    public TimeSpan MinimumGap { get; set; }
}

using System.ComponentModel.DataAnnotations;

namespace MathComps.Infrastructure.Options;

/// <summary>
/// How queued mail goes out: how often the outbox looks for what is due, and how long a failed mail waits.
/// </summary>
public class MailOutboxSettings : PollingSettings
{
    /// <summary>
    /// Configuration section name for these settings.
    /// </summary>
    public const string SectionName = "MailOutbox";

    /// <summary>
    /// How long a mail waits after each failed attempt before the next. The attempt failing after the last of them
    /// gives the mail up. Together they stay under a day, since a sender only recognises a repeated mail that long,
    /// and a retry any later could send the mail twice.
    /// </summary>
    [MinLength(1)]
    public IReadOnlyList<TimeSpan> RetryDelays { get; set; } = [];
}

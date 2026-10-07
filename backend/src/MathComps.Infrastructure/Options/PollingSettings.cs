using System.ComponentModel.DataAnnotations;

namespace MathComps.Infrastructure.Options;

/// <summary>
/// The settings of work a background loop does in passes.
/// </summary>
public abstract class PollingSettings
{
    /// <summary>
    /// How long apart the loop's passes start.
    /// </summary>
    [Range(typeof(TimeSpan), "00:00:01", "1.00:00:00", ParseLimitsInInvariantCulture = true)]
    public TimeSpan PollInterval { get; set; }
}

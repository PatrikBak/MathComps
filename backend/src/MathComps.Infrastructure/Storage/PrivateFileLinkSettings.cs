using System.ComponentModel.DataAnnotations;

namespace MathComps.Infrastructure.Storage;

/// <summary>
/// Settings for the links to files in the private bucket: how long a read link works, and how many links are kept in
/// memory to be handed out again. The annotations make a missing <c>PrivateFileLinks</c> section fail validation.
/// </summary>
public class PrivateFileLinkSettings
{
    /// <summary>
    /// Configuration section name for these settings.
    /// </summary>
    public const string SectionName = "PrivateFileLinks";

    /// <summary>
    /// How long a read link works from when it was signed. R2 takes a presigned link working seven days at most.
    /// </summary>
    [Range(typeof(TimeSpan), "00:01:00", "7.00:00:00", ParseLimitsInInvariantCulture = true)]
    public required TimeSpan LinkLifetime { get; set; }

    /// <summary>
    /// The most read links kept in memory at once, however many files links are asked for.
    /// </summary>
    [Range(1, int.MaxValue)]
    public required int MaxKeptLinks { get; set; }
}

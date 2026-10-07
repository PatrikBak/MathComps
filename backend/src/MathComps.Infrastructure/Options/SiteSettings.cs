using System.ComponentModel.DataAnnotations;

namespace MathComps.Infrastructure.Options;

/// <summary>
/// Where the site lives and how it is reached.
/// </summary>
public class SiteSettings
{
    /// <summary>
    /// Configuration section name for these settings.
    /// </summary>
    public const string SectionName = "Site";

    /// <summary>
    /// The site's public address, which every link out to it starts with (e.g. <c>https://mathcomps.fun</c>).
    /// </summary>
    [Required]
    [Url]
    public required string Url { get; set; }

    /// <summary>
    /// The site's own mail address (e.g. <c>contact@mathcomps.fun</c>).
    /// </summary>
    [Required]
    [EmailAddress]
    public required string ContactAddress { get; set; }
}

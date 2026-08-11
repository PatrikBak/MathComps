using System.ComponentModel.DataAnnotations;

namespace MathComps.Infrastructure.Options;

/// <summary>
/// How the API keeps its copy of the handout content the examiner is served from. The content is published
/// independently of a deploy, so the only thing deciding how quickly an edited problem reaches a new defense is
/// how long a cached copy is trusted before it is revalidated.
/// </summary>
public class DefenseContentOptions
{
    /// <summary>
    /// Configuration section name for these settings.
    /// </summary>
    public const string SectionName = "DefenseContent";

    /// <summary>
    /// How long a cached handout's content is served without checking the source, in seconds. Past it the next
    /// lookup revalidates, which costs a round trip and usually returns nothing to download — cheap against the
    /// model call it precedes, so this is a staleness budget rather than a performance one.
    /// </summary>
    [Range(1, int.MaxValue)]
    public required int CacheSeconds { get; set; }
}

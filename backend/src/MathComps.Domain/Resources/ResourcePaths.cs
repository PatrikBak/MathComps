using MathComps.Domain.Localization;

namespace MathComps.Domain.Resources;

/// <summary>
/// Shared resource paths used by both API and CLI tools.
/// Paths are relative to the application base directory.
/// </summary>
public static class ResourcePaths
{
    /// <summary>
    /// Path to the approved-tags.json file containing the tag vocabulary with localized names.
    /// </summary>
    public const string ApprovedTags = "Resources/approved-tags.json";

    /// <summary>
    /// Path to one language's copy file, holding lines the backend writes to people in its own words, one section
    /// per feature.
    /// </summary>
    /// <param name="language">The language.</param>
    /// <returns>The path, as copy.sk.json for Slovak.</returns>
    public static string Copy(Language language) => $"Resources/copy.{language.ToString().ToLowerInvariant()}.json";

    /// <summary>
    /// The metadata.shared.json file name — the language-neutral taxonomy structure (competitions, their
    /// categories and rounds, and the sort order of all three).
    /// </summary>
    public const string SharedMetadataFileName = "metadata.shared.json";

    /// <summary>
    /// Path to the <see cref="SharedMetadataFileName"/> resource, relative to the application base directory.
    /// </summary>
    public const string SharedMetadataFile = "Resources/" + SharedMetadataFileName;
}

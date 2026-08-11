namespace MathComps.Domain.Resources;

/// <summary>
/// Shared constants for resource paths used by both API and CLI tools.
/// Paths are relative to the application base directory.
/// </summary>
public static class ResourcePaths
{
    /// <summary>
    /// Path to the approved-tags.json file containing the tag vocabulary with localized names.
    /// </summary>
    public const string ApprovedTags = "Resources/approved-tags.json";

    /// <summary>
    /// Path to the defense-copy.json file holding the AI examiner's own localized lines.
    /// </summary>
    public const string DefenseCopy = "Resources/defense-copy.json";

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

namespace MathComps.Shared;

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
    /// Path to the metadata.shared.json file holding the language-neutral taxonomy structure
    /// (competitions, their categories and rounds, and the sort order of all three).
    /// </summary>
    public const string SharedMetadataFile = "Resources/metadata.shared.json";
}

namespace MathComps.Shared;

/// <summary>
/// Centralized constants for SKMO data file paths and directories.
/// Provides consistent path references across all MathComps tools and applications.
/// </summary>
public static class SkmoDataPaths
{
    #region Base Data Directory

    /// <summary>
    /// Relative path to the SKMO data directory from the solution root.
    /// This is the base directory containing all SKMO-related data files.
    /// </summary>
    public const string SkmoDataDirectory = "data/skmo";

    #endregion

    #region Archive Paths

    /// <summary>
    /// Relative path to the SKMO archive directory containing raw TeX files.
    /// Used by the SkmoProblems parser to read source TeX files.
    /// </summary>
    public const string SkmoArchiveDirectory = SkmoDataDirectory + "/Archive";

    /// <summary>
    /// Relative path to the SKMO HTML results directory.
    /// Used by the SkmoProblems parser to output rendered HTML previews.
    /// </summary>
    public const string SkmoHtmlResultsDirectory = SkmoDataDirectory + "/ArchiveHtml";

    /// <summary>
    /// Relative path to the SKMO images directory.
    /// Contains SVG images organized by year and manual overrides.
    /// </summary>
    public const string SkmoImagesDirectory = SkmoDataDirectory + "/Images";

    #endregion

    #region Data Files

    /// <summary>
    /// Relative path to the final processed SKMO archive JSON file.
    /// Contains the clean, validated data ready for database seeding.
    /// </summary>
    public const string SkmoParsedArchiveFile = SkmoDataDirectory + "/archive.parsed.json";

    #endregion
}

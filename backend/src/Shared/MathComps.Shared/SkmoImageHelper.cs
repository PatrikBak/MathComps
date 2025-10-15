namespace MathComps.Shared;

/// <summary>
/// Provides centralized logic for locating and managing problem images.
/// </summary>
public static class SkmoImageHelper
{
    /// <summary>
    /// Attempts to find the absolute path of an image based on SKMO's directory structure.
    /// It checks for year-specific folders first, then a manual override folder.
    /// </summary>
    /// <param name="texImageId">The image identifier from the TeX source (e.g., "obrazok.eps").</param>
    /// <param name="olympiadYear">The olympiad year, used to check the year-specific image folder.</param>
    /// <returns>The absolute file path to the SVG image, or <see langword="null"/> if not found.</returns>
    public static string? FindImageSourcePath(string texImageId, int olympiadYear)
    {
        // Replace explicit .pdf and .eps suffixes
        if (texImageId.EndsWith(".pdf") || texImageId.EndsWith(".eps"))
            texImageId = texImageId[..^4];

        // Image ids are used to locate names. They are already lower-cased so it
        // would work on Linux. However, tex sources still contain many upper-cased
        // names. This is the easiest way to fix it...
        texImageId = texImageId.ToLowerInvariant();

        // Define potential image directory using centralized path constants.
        var dataDirectory = Path.Combine("../../../../", SkmoDataPaths.SkmoImagesDirectory);

        // Check year-specific folder first, then the manual folder.
        string[] imagePaths =
        [
            Path.Combine(dataDirectory, $"{olympiadYear}/{texImageId}.svg"),
            Path.Combine(dataDirectory, $"Manual/{texImageId}.svg"),
        ];

        // Try to find it
        return imagePaths.FirstOrDefault(File.Exists);
    }
}

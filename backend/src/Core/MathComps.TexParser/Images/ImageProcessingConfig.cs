namespace MathComps.TexParser.Images;

/// <summary>
/// Configuration for <see cref="TexImageProcessor"/> that specifies how to resolve, name, and store images.
/// </summary>
/// <param name="ImageSourceResolver">Function that resolves a TeX image ID to an absolute source file path. Returns null if not found.</param>
/// <param name="FileNamePrefix">Prefix for generated image file names (e.g., "algebra-1-rozklady" or "50-a-i-1").</param>
/// <param name="OutputDirectory">Absolute path to the directory where processed images should be copied.</param>
/// <param name="OnMissingImage">Optional callback invoked when an image source cannot be resolved. Receives the TeX image ID.</param>
public record ImageProcessingConfig(
    Func<string, string?> ImageSourceResolver,
    string FileNamePrefix,
    string OutputDirectory,
    Action<string>? OnMissingImage = null
);

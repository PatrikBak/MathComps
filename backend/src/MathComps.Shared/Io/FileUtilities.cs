namespace MathComps.Shared.Io;

/// <summary>
/// File-reading helpers shared across the CLI tools.
/// </summary>
public static class FileUtilities
{
    /// <summary>
    /// Reads the whole text of a file at <paramref name="relativePath"/>, resolved against the app's base directory
    /// (not the working directory) so the read is independent of where the process was launched — content copied into
    /// the output directory.
    /// </summary>
    /// <param name="relativePath">Path to the file relative to the app's base directory (an absolute path is used
    /// as-is).</param>
    /// <param name="cancellationToken">A token to cancel the read.</param>
    /// <returns>The file's contents.</returns>
    public static async Task<string> ReadAppFileAsync(
        string relativePath, CancellationToken cancellationToken = default)
    {
        // Anchor on the base directory; an absolute relativePath wins, matching Path.Combine's rule.
        var resolvedPath = Path.Combine(AppContext.BaseDirectory, relativePath);

        // Read the whole file back.
        return await File.ReadAllTextAsync(resolvedPath, cancellationToken);
    }

    /// <summary>
    /// Reads the whole text of a required file within a folder, naming the file in the error when it isn't there.
    /// </summary>
    /// <param name="folder">The folder the file must be in.</param>
    /// <param name="fileName">The required file's name within the folder.</param>
    /// <param name="cancellationToken">A token to cancel the read.</param>
    /// <returns>The file's contents.</returns>
    public static async Task<string> ReadRequiredAsync(
        string folder, string fileName, CancellationToken cancellationToken = default)
    {
        // The file has to be there — a missing one gets a clear error naming it, not an opaque I/O exception.
        var path = Path.Combine(folder, fileName);
        if (!File.Exists(path))
            throw new FileNotFoundException($"Required file '{fileName}' not found in '{folder}'.", path);

        // Read the whole file back.
        return await File.ReadAllTextAsync(path, cancellationToken);
    }
}

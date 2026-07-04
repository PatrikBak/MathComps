namespace MathComps.Shared.Io;

/// <summary>
/// Reads files that ship alongside the running binary — content copied into the output directory. Resolving against
/// the app's base directory (not the working directory) is what makes these reads independent of where the process
/// was launched from.
/// </summary>
public static class AppFile
{
    /// <summary>
    /// Reads the whole text of a file at <paramref name="relativePath"/>, resolved against the app's base directory.
    /// </summary>
    /// <param name="relativePath">Path to the file relative to the app's base directory (an absolute path is used
    /// as-is).</param>
    /// <param name="cancellationToken">A token to cancel the read.</param>
    /// <returns>The file's contents.</returns>
    public static async Task<string> ReadAllTextAsync(string relativePath, CancellationToken cancellationToken = default)
    {
        // Anchor on the base directory; an absolute relativePath wins, matching Path.Combine's rule.
        var resolvedPath = Path.Combine(AppContext.BaseDirectory, relativePath);

        // Read the whole file back.
        return await File.ReadAllTextAsync(resolvedPath, cancellationToken);
    }
}

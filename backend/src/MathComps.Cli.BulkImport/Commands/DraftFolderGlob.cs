namespace MathComps.Cli.BulkImport.Commands;

/// <summary>
/// Expands the folder argument(s) the <c>validate</c> and <c>apply</c> commands accept into the concrete draft
/// folders to run over. Each argument is a literal path or a wildcard pattern whose leaf segment selects sibling
/// directories — the directory analog of the file glob the Handouts CLI uses — so one invocation can sweep a whole
/// batch (e.g. <c>data/problems/skmo-2025-*</c>).
/// </summary>
public static class DraftFolderGlob
{
    /// <summary>
    /// Expands the given path/glob patterns into the matching draft folders.
    /// </summary>
    /// <param name="patterns">Literal folder paths and/or wildcard patterns whose leaf segment is matched against
    /// the sibling directories of its parent.</param>
    /// <returns>The absolute paths of every matched folder, de-duplicated and ordered. Empty when nothing
    /// matches.</returns>
    public static IReadOnlyList<string> Expand(IEnumerable<string> patterns) =>
        // Expand each pattern, then union the matches into one de-duplicated, ordered list.
        [.. patterns
            .SelectMany(ExpandOne)
            .Distinct()
            .OrderBy(path => path, StringComparer.Ordinal)];

    /// <summary>
    /// Expands a single path/glob pattern into the folders it matches.
    /// </summary>
    /// <param name="pattern">A literal folder path or a wildcard pattern.</param>
    /// <returns>The absolute paths of the matched folders, or none if the parent is absent or nothing matches.</returns>
    private static IEnumerable<string> ExpandOne(string pattern)
    {
        // Strip any trailing separator so the leaf is the folder name, not an empty string.
        var trimmed = pattern.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);

        // Split the pattern into its parent directory and the leaf name (which may carry the wildcards).
        var parent = Path.GetDirectoryName(trimmed);
        var leaf = Path.GetFileName(trimmed);

        // Resolve the directory to match within — an empty parent means the cwd.
        var baseDirectory = new DirectoryInfo(string.IsNullOrEmpty(parent) ? "." : parent);

        // A parent that doesn't exist matches nothing — GetDirectories would otherwise throw.
        if (!baseDirectory.Exists)
            return [];

        // Match the leaf against the parent's immediate subdirectories; a literal leaf yields its single folder.
        return baseDirectory
            .GetDirectories(leaf, SearchOption.TopDirectoryOnly)
            .Select(directory => directory.FullName);
    }
}

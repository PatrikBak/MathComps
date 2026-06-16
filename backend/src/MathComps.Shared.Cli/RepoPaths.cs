namespace MathComps.Shared.Cli;

/// <summary>
/// Resolves paths inside the MathComps repository relative to its root, anchoring on the running assembly's
/// location instead of the process working directory. This lets every CLI tool be launched from any directory
/// (or via <c>dotnet run --project</c> from the repo root) and still find repo content like <c>data/</c> and
/// <c>web/</c>.
/// </summary>
public static class RepoPaths
{
    /// <summary>
    /// The repo root, discovered once on first access and cached.
    /// </summary>
    private static readonly Lazy<string> _lazyRepoRoot = new(LocateRepoRoot);

    /// <summary>
    /// The absolute path to the MathComps repository root.
    /// </summary>
    private static string RepoRoot => _lazyRepoRoot.Value;

    /// <summary>
    /// Combines repo-relative segments into an absolute path under the <see cref="RepoRoot"/>.
    /// </summary>
    /// <param name="segments">Path segments relative to the repo root, e.g. <c>"data/handouts"</c>.</param>
    /// <returns>The absolute path to the requested location inside the repository.</returns>
    public static string Resolve(params string[] segments) =>
        Path.Combine([RepoRoot, .. segments]);

    /// <summary>
    /// Walks up from the running assembly's directory to the repo root, identified by its <c>web/package.json</c>.
    /// Resolving from the assembly location keeps this independent of the working directory the CLI is launched from.
    /// </summary>
    /// <returns>The absolute path to the repository root.</returns>
    private static string LocateRepoRoot()
    {
        // Start at the bin directory the CLI runs from and climb toward the repo root.
        for (var directory = new DirectoryInfo(AppContext.BaseDirectory);
             directory != null;
             directory = directory.Parent)
        {
            // The repo root is the first ancestor whose web/ subfolder carries a package.json.
            if (File.Exists(Path.Combine(directory.FullName, "web", "package.json")))
                return directory.FullName;
        }

        // No ancestor looked like the repo root — the CLI is being run from outside the repository.
        throw new InvalidOperationException(
            $"Could not locate the MathComps repository root above '{AppContext.BaseDirectory}'. " +
            "Run the CLI from within the MathComps repository.");
    }
}

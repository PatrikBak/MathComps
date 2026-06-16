using MathComps.Cli.BulkImport.Commands;

namespace MathComps.Cli.BulkImport.Tests;

/// <summary>
/// Tests the path/glob expansion that lets <c>validate</c> and <c>apply</c> sweep multiple draft folders in one
/// invocation. Runs against real throwaway directories so it exercises the same on-disk matching the commands do.
/// </summary>
public class DraftFolderGlobTests : IDisposable
{
    /// <summary>A throwaway root holding the seeded draft folders, cleaned up after each test.</summary>
    private readonly string _root;

    /// <summary>
    /// Creates the throwaway root and seeds three sibling draft folders plus a stray file.
    /// </summary>
    public DraftFolderGlobTests()
    {
        // Seed three sibling draft folders under a throwaway root.
        _root = Path.Combine(Path.GetTempPath(), $"draftglob-{Guid.NewGuid():N}");
        Directory.CreateDirectory(Path.Combine(_root, "skmo-2025-i-a"));
        Directory.CreateDirectory(Path.Combine(_root, "skmo-2025-i-b"));
        Directory.CreateDirectory(Path.Combine(_root, "naboj-2025"));

        // A file the directory glob must never pick up.
        File.WriteAllText(Path.Combine(_root, "skmo-2025-notes.txt"), "ignore me");
    }

    /// <inheritdoc/>
    public void Dispose()
    {
        // Wipe the throwaway root.
        Directory.Delete(_root, recursive: true);

        // No finalizer to run.
        GC.SuppressFinalize(this);
    }

    /// <summary>
    /// A literal folder path expands to exactly that one folder.
    /// </summary>
    [Fact]
    public void A_literal_path_matches_its_one_folder()
    {
        // Expanding the literal path yields exactly one folder.
        var folder = Assert.Single(DraftFolderGlob.Expand([Path.Combine(_root, "naboj-2025")]));

        // And it's that folder, as an absolute path.
        Assert.Equal(Path.Combine(_root, "naboj-2025"), folder);
    }

    /// <summary>
    /// A trailing separator on a literal path is tolerated — the folder name, not an empty leaf, is matched.
    /// </summary>
    [Fact]
    public void A_trailing_separator_is_tolerated()
    {
        // A literal path carrying a trailing separator.
        var pathWithSeparator = Path.Combine(_root, "naboj-2025") + Path.DirectorySeparatorChar;

        // The same folder resolves whether or not the path ends in a separator.
        var folder = Assert.Single(DraftFolderGlob.Expand([pathWithSeparator]));

        // And it's that folder, with the trailing separator gone.
        Assert.Equal(Path.Combine(_root, "naboj-2025"), folder);
    }

    /// <summary>
    /// A wildcard matches every sibling folder whose name fits, and never a file.
    /// </summary>
    [Fact]
    public void A_wildcard_matches_sibling_folders_only()
    {
        // Expand the wildcard against the seeded folders.
        var folders = DraftFolderGlob.Expand([Path.Combine(_root, "skmo-2025-*")]);

        // Both skmo folders match; the stray .txt with the same prefix does not.
        Assert.Equal(
            [Path.Combine(_root, "skmo-2025-i-a"), Path.Combine(_root, "skmo-2025-i-b")],
            folders);
    }

    /// <summary>
    /// A bare wildcard sweeps every sibling folder — the headline batch case — and still skips the stray file.
    /// </summary>
    [Fact]
    public void A_bare_wildcard_matches_every_folder()
    {
        // Expand a catch-all wildcard against the root (the data/problems/* batch case).
        var folders = DraftFolderGlob.Expand([Path.Combine(_root, "*")]);

        // All three folders come back ordered; the stray .txt is left out.
        Assert.Equal(
            [
                Path.Combine(_root, "naboj-2025"),
                Path.Combine(_root, "skmo-2025-i-a"),
                Path.Combine(_root, "skmo-2025-i-b")
            ],
            folders);
    }

    /// <summary>
    /// Multiple patterns are unioned and de-duplicated, with overlapping matches collapsed to one.
    /// </summary>
    [Fact]
    public void Multiple_patterns_are_unioned_and_deduped()
    {
        // The wildcard already covers skmo-2025-i-a, so naming it again literally must not double it.
        var folders = DraftFolderGlob.Expand([
            Path.Combine(_root, "skmo-2025-*"),
            Path.Combine(_root, "skmo-2025-i-a"),
            Path.Combine(_root, "naboj-2025")]);

        // The overlap collapses to one entry, and the whole set comes back ordered.
        Assert.Equal(
            [
                Path.Combine(_root, "naboj-2025"),
                Path.Combine(_root, "skmo-2025-i-a"),
                Path.Combine(_root, "skmo-2025-i-b")
            ],
            folders);
    }

    /// <summary>
    /// A pattern that matches nothing — and a pattern whose parent doesn't exist — both yield no folders.
    /// </summary>
    [Fact]
    public void A_non_matching_or_absent_pattern_yields_nothing()
    {
        // A leaf that matches no sibling yields nothing.
        Assert.Empty(DraftFolderGlob.Expand([Path.Combine(_root, "does-not-exist-*")]));

        // A pattern whose parent directory isn't there yields nothing.
        Assert.Empty(DraftFolderGlob.Expand([Path.Combine(_root, "no-such-parent", "anything")]));
    }
}

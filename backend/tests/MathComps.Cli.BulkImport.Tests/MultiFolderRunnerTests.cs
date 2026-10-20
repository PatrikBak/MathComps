using MathComps.Cli.BulkImport.Commands;
using Spectre.Console;

namespace MathComps.Cli.BulkImport.Tests;

/// <summary>
/// Tests how the bulk import's runner treats the folder patterns it is handed. Runs against a real throwaway
/// directory so the patterns resolve the way they do on disk. The runner writes to the console, which another test
/// swaps out, so it shares a collection with every other test writing there.
/// </summary>
[Collection(nameof(AnsiConsole))]
public class MultiFolderRunnerTests : IDisposable
{
    /// <summary>A throwaway root holding one draft folder, cleaned up after each test.</summary>
    private readonly string _root;

    /// <summary>
    /// Creates the throwaway root and its one draft folder.
    /// </summary>
    public MultiFolderRunnerTests()
    {
        // One draft folder under a throwaway root.
        _root = Path.Combine(Path.GetTempPath(), $"multifolder-{Guid.NewGuid():N}");
        Directory.CreateDirectory(Path.Combine(_root, "draft"));
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
    /// A pattern matching no folder stops the whole run before any folder is touched. A word meant as something else,
    /// such as a verb like <c>validate</c>, reads as one more pattern, and running the folders beside it would import
    /// them for real.
    /// </summary>
    [Fact]
    public async Task A_pattern_matching_no_folder_runs_none_of_them()
    {
        // The folders the run reached.
        var reached = new List<string>();

        // A verb beside a real draft folder.
        var exitCode = await MultiFolderRunner.RunAsync(
            ["validate", Path.Combine(_root, "draft")], okLabel: "imported",
            folder =>
            {
                // Record the folder.
                reached.Add(folder);

                // The folder counts as a success.
                return Task.FromResult(true);
            });

        // The run fails without reaching the real folder.
        Assert.Equal(1, exitCode);
        Assert.Empty(reached);
    }
}

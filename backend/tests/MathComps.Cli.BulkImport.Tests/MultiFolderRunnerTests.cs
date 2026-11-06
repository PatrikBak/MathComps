using MathComps.Cli.BulkImport.Commands;
using Microsoft.Extensions.Logging.Abstractions;

namespace MathComps.Cli.BulkImport.Tests;

/// <summary>
/// Tests how the bulk import's runner treats the folder patterns it is handed. Runs against a real throwaway
/// directory so the patterns resolve the way they do on disk.
/// </summary>
public class MultiFolderRunnerTests : IDisposable
{
    /// <summary>A throwaway root holding the draft folder every test starts from, cleaned up after each test.</summary>
    private readonly string _root;

    /// <summary>
    /// Creates the throwaway root and its one draft folder.
    /// </summary>
    public MultiFolderRunnerTests()
    {
        // A throwaway root, unique to this test.
        _root = Path.Combine(Path.GetTempPath(), $"multifolder-{Guid.NewGuid():N}");

        // One draft folder under the root.
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

        // Run a verb beside a real draft folder.
        var exitCode = await MultiFolderRunner.RunAsync(
            NullLogger.Instance, ["validate", Path.Combine(_root, "draft")], okLabel: "imported",
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

    /// <summary>
    /// A folder whose work throws, say a database that went away mid-batch, fails alone. The folders after it still
    /// run, and the run as a whole fails.
    /// </summary>
    [Fact]
    public async Task A_folder_that_throws_fails_alone()
    {
        // A second draft folder beside the first.
        var second = Directory.CreateDirectory(Path.Combine(_root, "draft-2")).FullName;

        // The folders the run reached.
        var reached = new List<string>();

        // Run both folders, the first of them throwing.
        var exitCode = await MultiFolderRunner.RunAsync(
            NullLogger.Instance, [Path.Combine(_root, "draft"), second], okLabel: "imported",
            folder =>
            {
                // Record the folder.
                reached.Add(folder);

                // The first folder throws, the second succeeds.
                return folder == second ? Task.FromResult(true) : throw new InvalidOperationException();
            });

        // The run reaches both folders and fails.
        Assert.Equal(2, reached.Count);
        Assert.Equal(1, exitCode);
    }
}

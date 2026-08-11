using System.Collections.Immutable;
using System.Diagnostics;

namespace MathComps.Shared.Diagnostics;

/// <summary>
/// Helper for spawning external executables with redirected stdout/stderr. Reads both pipes concurrently while
/// awaiting the child's exit, so neither buffer fills and blocks the child (the classic
/// "pipe-buffer full, child blocks, parent waits forever" deadlock, which also clips large output), and surfaces
/// the exit code plus captured output so callers can apply their own failure policy (log file vs. exception,
/// retries, etc.).
/// </summary>
public static class ProcessRunner
{
    /// <summary>
    /// The outcome of a single process invocation.
    /// </summary>
    /// <param name="ExitCode">The exit code returned by the child process (0 means success).</param>
    /// <param name="Stdout">Everything the child wrote to its standard output stream.</param>
    /// <param name="Stderr">Everything the child wrote to its standard error stream.</param>
    public record Result(int ExitCode, string Stdout, string Stderr);

    /// <summary>
    /// Runs an external executable to completion and returns its captured output.
    /// Each entry in <paramref name="arguments"/> becomes one argv entry on the child,
    /// with .NET handling the platform-specific quoting — pass paths and flags as
    /// separate elements rather than pre-joining them into a single string.
    /// Failure to START the process (executable not found, etc.) throws a
    /// <see cref="System.ComponentModel.Win32Exception"/>; non-zero exits from a
    /// successfully-started process are reported via <see cref="Result.ExitCode"/>.
    /// </summary>
    /// <param name="fileName">The executable name (resolved against PATH) or absolute path.</param>
    /// <param name="arguments">Arguments passed to the child, one argv entry per element.</param>
    /// <param name="workingDirectory">The working directory the child inherits.</param>
    /// <param name="environment">Variables set on the child on top of the ones it inherits, for a tool steered by
    /// its environment.</param>
    /// <returns>A task producing the exit code plus everything the process wrote to stdout and stderr.</returns>
    public static async Task<Result> RunAsync(
        string fileName,
        IReadOnlyList<string> arguments,
        string workingDirectory,
        IReadOnlyDictionary<string, string>? environment = null)
    {
        // Configure the spawn: redirect both streams so we can capture them, no console window, no shell.
        var processInfo = new ProcessStartInfo
        {
            FileName = fileName,
            WorkingDirectory = workingDirectory,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };

        // ArgumentList lets the runtime quote each argv entry correctly for the platform
        foreach (var argument in arguments)
            processInfo.ArgumentList.Add(argument);

        // Layer the caller's variables over the inherited ones, which ProcessStartInfo has pre-populated
        foreach (var (name, value) in environment ?? ImmutableDictionary<string, string>.Empty)
            processInfo.Environment[name] = value;

        // Start the child; a null return here is unusual but documented for Process.Start
        using var process = Process.Start(processInfo)
            ?? throw new InvalidOperationException($"Failed to start '{fileName}'");

        // Kick off both reads before waiting — concurrent draining keeps either pipe buffer from filling and
        // blocking the child.
        var stdoutTask = process.StandardOutput.ReadToEndAsync();
        var stderrTask = process.StandardError.ReadToEndAsync();

        // Wait for the child to exit.
        await process.WaitForExitAsync();

        // Drain both reads — at EOF they hold everything the child wrote.
        var stdout = await stdoutTask;
        var stderr = await stderrTask;

        // Hand back everything the caller needs to decide success vs. failure semantics
        return new Result(process.ExitCode, stdout, stderr);
    }
}

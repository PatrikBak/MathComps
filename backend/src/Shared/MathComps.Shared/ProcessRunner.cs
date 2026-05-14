using System.Diagnostics;

namespace MathComps.Shared;

/// <summary>
/// Helper for spawning external executables with redirected stdout/stderr.
/// Drains both pipes before waiting on the child to avoid the classic
/// "pipe-buffer full, child blocks, parent waits forever" deadlock, and
/// surfaces the exit code plus captured output so callers can apply their
/// own failure policy (log file vs. exception, retries, etc.).
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
    /// <returns>The exit code plus everything the process wrote to stdout and stderr.</returns>
    public static Result Run(string fileName, IReadOnlyList<string> arguments, string workingDirectory)
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

        // Start the child; a null return here is unusual but documented for Process.Start
        using var process = Process.Start(processInfo)
            ?? throw new InvalidOperationException($"Failed to start '{fileName}'");

        // Drain output streams BEFORE WaitForExit — otherwise a chatty child fills the pipe buffer and deadlocks
        var stdout = process.StandardOutput.ReadToEnd();
        var stderr = process.StandardError.ReadToEnd();

        // Once both streams are fully drained, the child is free to finish
        process.WaitForExit();

        // Hand back everything the caller needs to decide success vs. failure semantics
        return new Result(process.ExitCode, stdout, stderr);
    }
}

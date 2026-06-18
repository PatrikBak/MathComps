using Spectre.Console;

namespace MathComps.Shared.Cli;

/// <summary>
/// Thread-safe console logging for CLI tools: writes timestamped lines under a shared lock, so lines emitted from
/// concurrent work never interleave mid-line.
/// </summary>
public static class CliLog
{
    /// <summary>
    /// Serializes the writes so lines from concurrent callers never interleave mid-line.
    /// </summary>
    private static readonly Lock _writeLock = new();

    /// <summary>
    /// Writes one timestamped line. The caller supplies Spectre markup, so only safe literals and numbers should be
    /// interpolated into it — escape any free text with <see cref="Markup.Escape"/> first.
    /// </summary>
    /// <param name="markup">The Spectre-markup line to write after the timestamp.</param>
    public static void Line(string markup)
    {
        // Write the timestamped line under the lock.
        lock (_writeLock)
            AnsiConsole.MarkupLine($"[grey]{DateTime.Now:HH:mm:ss}[/] {markup}");
    }
}

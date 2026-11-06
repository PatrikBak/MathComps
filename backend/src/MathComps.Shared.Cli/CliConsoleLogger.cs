using System.Text;
using Microsoft.Extensions.Logging;

namespace MathComps.Shared.Cli;

/// <summary>
/// The console logger every CLI tool logs through. Each line of an entry's text, its exception's stack trace
/// included, opens with the time, the level and the entry's source (the class name, for a class's own logger), so a
/// multi-line message keeps its lines and every one of them is timed. The level is coloured only when the output is a
/// terminal. An entry is on stdout by the time the call returns, so a crash keeps every earlier line, and a reader
/// that stops reading blocks the tool.
/// </summary>
/// <param name="category">The logger's category, usually the full name of the class that logs through it.</param>
/// <param name="timestampFormat"><inheritdoc cref="CliConsoleLoggerSettings.TimestampFormat" path="/summary"/></param>
internal sealed class CliConsoleLogger(string category, string timestampFormat) : ILogger
{
    /// <summary>
    /// Whether the output goes to a terminal.
    /// </summary>
    private static readonly bool _isTerminal = !Console.IsOutputRedirected;

    /// <summary>
    /// The category's last dotted segment, the bare class name for a class's own logger.
    /// </summary>
    private readonly string _source = category[(category.LastIndexOf('.') + 1)..];

    /// <inheritdoc/>
    public IDisposable? BeginScope<TState>(TState state)
        where TState : notnull => null;

    /// <inheritdoc/>
    public bool IsEnabled(LogLevel logLevel) => logLevel != LogLevel.None;

    /// <inheritdoc/>
    public void Log<TState>(
        LogLevel logLevel,
        EventId eventId,
        TState state,
        Exception? exception,
        Func<TState, Exception?, string> formatter)
    {
        // The level that turns logging off writes nothing
        if (!IsEnabled(logLevel))
            return;

        // The entry's message, with the exception's own lines below it when there is one
        var message = formatter(state, exception);
        var text = exception is null ? message : $"{message}\n{exception}";

        // The time, the level and the source, shared by every line of the entry
        var time = DateTimeOffset.Now.ToString(timestampFormat);
        var prefix = $"{time}{LevelLabel(logLevel)} {_source}: ";

        // The whole entry, one prefixed line per line of the text
        var entry = new StringBuilder();

        // Put each line of the text under the prefix
        foreach (var line in text.Split('\n'))
            entry.Append(prefix).Append(line.TrimEnd('\r')).AppendLine();

        // Write the entry in one call, which the console serializes, so parallel entries never interleave
        Console.Out.Write(entry.ToString());
    }

    /// <summary>
    /// The four-letter level name Microsoft's console logger uses too, coloured on a terminal.
    /// </summary>
    /// <param name="level">The entry's level.</param>
    /// <returns>The level's name, wrapped in its colour's escape codes when the output is a terminal.</returns>
    private static string LevelLabel(LogLevel level)
    {
        // The ANSI escape codes for the label colours, and the one that resets them
        const string grey = "\e[90m";
        const string green = "\e[32m";
        const string yellow = "\e[33m";
        const string red = "\e[31m";
        const string reset = "\e[0m";

        // The level's name and its colour
        var (name, colour) = level switch
        {
            LogLevel.Trace => ("trce", grey),
            LogLevel.Debug => ("dbug", grey),
            LogLevel.Information => ("info", green),
            LogLevel.Warning => ("warn", yellow),
            LogLevel.Error => ("fail", red),
            LogLevel.Critical => ("crit", red),
            _ => throw new ArgumentOutOfRangeException(nameof(level), level, "Unknown log level"),
        };

        // Colour the name only where a terminal will render the escape codes
        return _isTerminal ? $"{colour}{name}{reset}" : name;
    }
}

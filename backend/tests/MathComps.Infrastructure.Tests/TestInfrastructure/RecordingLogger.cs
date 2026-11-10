using System.Collections.Concurrent;
using Microsoft.Extensions.Logging;

namespace MathComps.Infrastructure.Tests.TestInfrastructure;

/// <summary>
/// A logger keeping every entry it is handed, at every level, with the values its template names. The
/// Microsoft.Extensions.Diagnostics.Testing fake needs newer Microsoft.Extensions packages than the solution pins.
/// </summary>
/// <typeparam name="T">The category the logger logs for.</typeparam>
public sealed class RecordingLogger<T> : ILogger<T>
{
    /// <summary>
    /// One entry the logger was handed.
    /// </summary>
    /// <param name="Level">The entry's level.</param>
    /// <param name="Values">The values its template names, by name.</param>
    /// <param name="Exception">The exception it carries, if any.</param>
    public sealed record Entry(LogLevel Level, IReadOnlyDictionary<string, object?> Values, Exception? Exception);

    /// <summary>
    /// The entries, queued as they are logged.
    /// </summary>
    private readonly ConcurrentQueue<Entry> _entries = new();

    /// <summary>
    /// Every entry logged so far, in the order logged.
    /// </summary>
    public IReadOnlyList<Entry> Entries => [.. _entries];

    /// <inheritdoc/>
    public IDisposable? BeginScope<TState>(TState state) where TState : notnull =>
        // The entries are kept without their scopes
        null;

    /// <inheritdoc/>
    public bool IsEnabled(LogLevel logLevel) =>
        // Every level is kept
        true;

    /// <inheritdoc/>
    public void Log<TState>(
        LogLevel logLevel,
        EventId eventId,
        TState state,
        Exception? exception,
        Func<TState, Exception?, string> formatter) =>
        // Keep the entry with the values its template names
        _entries.Enqueue(new Entry(
            logLevel,
            (state as IEnumerable<KeyValuePair<string, object?>> ?? [])
                .ToDictionary(pair => pair.Key, pair => pair.Value),
            exception));
}

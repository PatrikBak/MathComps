using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace MathComps.Shared.Cli;

/// <summary>
/// The logger provider behind every CLI tool's log lines, one <see cref="CliConsoleLogger"/> per category. Its alias
/// names the Logging section's <c>Console</c> part as its own: <see cref="CliConsoleLoggerSettings"/> binds from there,
/// and a <c>LogLevel</c> there applies to this provider alone.
/// </summary>
/// <param name="cliConsoleLoggerSettings"><inheritdoc cref="CliConsoleLoggerSettings" path="/summary"/></param>
[ProviderAlias("Console")]
internal sealed class CliConsoleLoggerProvider(IOptions<CliConsoleLoggerSettings> cliConsoleLoggerSettings)
    : ILoggerProvider
{
    /// <inheritdoc/>
    public ILogger CreateLogger(string categoryName) =>
        // A logger for the category, timing its lines in the configured format
        new CliConsoleLogger(categoryName, cliConsoleLoggerSettings.Value.TimestampFormat);

    /// <inheritdoc/>
    public void Dispose()
    {
    }
}

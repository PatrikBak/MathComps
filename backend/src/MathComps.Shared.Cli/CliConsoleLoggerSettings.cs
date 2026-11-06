namespace MathComps.Shared.Cli;

/// <summary>
/// How <see cref="CliConsoleLogger"/> writes each line.
/// </summary>
internal sealed class CliConsoleLoggerSettings
{
    /// <summary>
    /// The format of the time that opens each line, the space after it included.
    /// </summary>
    public required string TimestampFormat { get; set; }
}

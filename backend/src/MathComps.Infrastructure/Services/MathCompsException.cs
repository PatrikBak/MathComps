using Microsoft.Extensions.Logging;

namespace MathComps.Infrastructure.Services;

/// <summary>
/// A business failure that knows what kind of refusal it is and how loudly it is worth logging.
/// </summary>
/// <param name="message">What went wrong, worded for the caller.</param>
/// <param name="kind"><inheritdoc cref="Kind" path="/summary"/></param>
/// <param name="logLevel"><inheritdoc cref="LogLevel" path="/summary"/></param>
public abstract class MathCompsException(string message, RefusalKind kind, LogLevel logLevel) : Exception(message)
{
    /// <summary>
    /// What kind of refusal the failure is.
    /// </summary>
    public RefusalKind Kind { get; } = kind;

    /// <summary>
    /// The level the failure is logged at: <see cref="LogLevel.Error"/> when only a bug can cause it (broken content
    /// or configuration, or a request our own screens never send), <see cref="LogLevel.Information"/> when a rule is
    /// doing its job, such as refusing a page that went out of date while someone else acted or a clock ran out.
    /// </summary>
    public LogLevel LogLevel { get; } = logLevel;
}

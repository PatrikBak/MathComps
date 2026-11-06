using Microsoft.Extensions.Logging;
using Spectre.Console.Cli;

namespace MathComps.Shared.Cli.Commands;

/// <summary>
/// The entry point every CLI tool runs its <see cref="ICommandApp"/> through, logging an unhandled exception as an
/// error.
/// </summary>
public static class CliRunner
{
    /// <summary>
    /// Runs the CLI application with <see cref="ConfiguratorExtensions.PropagateExceptions(IConfigurator)"/> enabled
    /// and a top-level catch that logs an unhandled exception, stack trace included, as an error.
    /// </summary>
    /// <param name="app">The Spectre.Console command app to run.</param>
    /// <param name="args">The tool's command-line arguments.</param>
    /// <param name="logger">The logger an unhandled exception is reported through.</param>
    /// <param name="configure">
    /// Optional configuration callback for registering commands and other settings.
    /// <see cref="ConfiguratorExtensions.PropagateExceptions(IConfigurator)"/> is always appended automatically.
    /// </param>
    /// <returns>The process exit code: the command's own, or 1 on an unhandled exception.</returns>
    public static async Task<int> RunAsync(
        ICommandApp app,
        string[] args,
        ILogger logger,
        Action<IConfigurator>? configure = null)
    {
        // Merge caller-provided configuration with the mandatory PropagateExceptions setting
        app.Configure(config =>
        {
            // Apply any caller-provided command registrations or settings
            configure?.Invoke(config);

            // Ensure exceptions bubble up so we can report them below
            config.PropagateExceptions();
        });

        try
        {
            // Run the application and return its exit code
            return await app.RunAsync(args);
        }
        catch (Exception exception)
        {
            // Log the exception with its stack trace
            logger.LogError(exception, "The tool stopped on an unhandled exception");

            // Signal failure to the calling process
            return 1;
        }
    }
}

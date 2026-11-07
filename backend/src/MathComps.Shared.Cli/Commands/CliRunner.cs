using Microsoft.Extensions.Logging;
using Spectre.Console.Cli;

namespace MathComps.Shared.Cli.Commands;

/// <summary>
/// The entry point every CLI tool runs its <see cref="ICommandApp"/> through, refusing an option no command defines
/// and logging whatever stops the run as an error.
/// </summary>
public static class CliRunner
{
    /// <summary>
    /// Runs the CLI application with <see cref="ConfiguratorExtensions.UseStrictParsing(IConfigurator)"/> and
    /// <see cref="ConfiguratorExtensions.PropagateExceptions(IConfigurator)"/> enabled. A command line that fails to
    /// parse is logged as its message alone, before any command runs; any other unhandled exception is logged with its
    /// stack trace.
    /// </summary>
    /// <param name="app">The Spectre.Console command app to run.</param>
    /// <param name="args">The tool's command-line arguments.</param>
    /// <param name="logger">The logger a parse error or an unhandled exception is reported through.</param>
    /// <param name="configure">
    /// Optional configuration callback for registering commands and other settings.
    /// <see cref="ConfiguratorExtensions.UseStrictParsing(IConfigurator)"/> and
    /// <see cref="ConfiguratorExtensions.PropagateExceptions(IConfigurator)"/> are always appended automatically.
    /// </param>
    /// <returns>
    /// The process exit code: the command's own, or 1 on a command line that fails to parse or an unhandled
    /// exception.
    /// </returns>
    public static async Task<int> RunAsync(
        ICommandApp app,
        string[] args,
        ILogger logger,
        Action<IConfigurator>? configure = null)
    {
        // Merge caller-provided configuration with the mandatory parsing and exception settings
        app.Configure(config =>
        {
            // Apply any caller-provided command registrations or settings
            configure?.Invoke(config);

            // Refuse an option no command defines, so a misspelled flag stops the run before any command starts
            config.UseStrictParsing();

            // Ensure exceptions bubble up so we can report them below
            config.PropagateExceptions();
        });

        try
        {
            // Run the application and return its exit code
            return await app.RunAsync(args);
        }
        catch (CommandParseException exception)
        {
            // Log what is wrong with the command line
            logger.LogError("{Refusal}", exception.Message);

            // Signal failure to the calling process
            return 1;
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

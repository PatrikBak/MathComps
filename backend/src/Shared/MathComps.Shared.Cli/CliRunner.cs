using Spectre.Console;
using Spectre.Console.Cli;

namespace MathComps.Shared.Cli;

/// <summary>
/// Provides a unified entry point for running Spectre.Console.Cli applications
/// with consistent exception handling across all CLI tools.
/// </summary>
public static class CliRunner
{
    /// <summary>
    /// Runs the CLI application with <see cref="IConfigurator.PropagateExceptions"/>
    /// enabled and a top-level catch that formats unhandled exceptions via
    /// <see cref="AnsiConsole.WriteException"/>.
    /// </summary>
    /// <param name="app">The Spectre.Console command app to run.</param>
    /// <param name="args">Command-line arguments forwarded from <c>Program.cs</c>.</param>
    /// <param name="configure">
    /// Optional configuration callback for registering commands and other settings.
    /// <see cref="IConfigurator.PropagateExceptions"/> is always appended automatically.
    /// </param>
    /// <returns>The process exit code: 0 on success, 1 on unhandled exception.</returns>
    public static async Task<int> RunAsync(
        ICommandApp app,
        string[] args,
        Action<IConfigurator>? configure = null)
    {
        // Merge caller-provided configuration with the mandatory PropagateExceptions setting
        app.Configure(config =>
        {
            // Apply any caller-provided command registrations or settings
            configure?.Invoke(config);

            // Ensure exceptions bubble up so we can format them cleanly below
            config.PropagateExceptions();
        });

        try
        {
            // Run the application and return its exit code
            return await app.RunAsync(args);
        }
        catch (Exception exception)
        {
            // Format the exception with shortened paths for readability
            AnsiConsole.WriteException(exception, ExceptionFormats.ShortenEverything);

            // Signal failure to the calling process
            return 1;
        }
    }
}

using MathComps.Shared.Cli.Commands;
using Microsoft.Extensions.Logging.Abstractions;
using Spectre.Console.Cli;

namespace MathComps.Shared.Tests.Cli;

/// <summary>
/// Tests for <see cref="CliRunner"/>: that a command line naming an option no command defines stops the run before
/// the command does anything.
/// </summary>
public class CliRunnerTests
{
    /// <summary>
    /// A misspelled flag fails the run with exit code 1, and the command it was meant for never runs.
    /// </summary>
    [Fact]
    public async Task Unknown_option_stops_the_run_before_the_command()
    {
        // Whether the command got to run
        var commandRan = false;

        // Run a command that records running, passing it a flag it doesn't define
        var exitCode = await CliRunner.RunAsync(
            new CommandApp(), ["run", "--bogus"], NullLogger.Instance,
            config => config.AddDelegate("run", _ =>
            {
                // Record that the command ran
                commandRan = true;

                // Report success
                return 0;
            }));

        // The run failed, and the command never started
        Assert.Equal(1, exitCode);
        Assert.False(commandRan);
    }
}

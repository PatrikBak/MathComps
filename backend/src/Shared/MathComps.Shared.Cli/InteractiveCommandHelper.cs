using Spectre.Console;
using Spectre.Console.Cli;
using System.Text.RegularExpressions;

namespace MathComps.Shared.Cli;

/// <summary>
/// Base class for interactive CLI commands that provide REPL-style command interfaces.
/// Handles the common interactive command loop pattern, input parsing, and error recovery
/// while allowing derived classes to implement specific command behaviors.
/// </summary>
public abstract class InteractiveCommandHelper : AsyncCommand
{
    /// <summary>
    /// Gets the application name displayed in the startup banner.
    /// </summary>
    protected abstract string ApplicationName { get; }

    /// <summary>
    /// Gets the description displayed in the startup banner.
    /// </summary>
    protected abstract string ApplicationDescription { get; }

    /// <summary>
    /// Gets the command usage hint displayed in the startup banner.
    /// </summary>
    protected abstract string CommandUsageHint { get; }

    /// <inheritdoc/>
    public override async Task<int> ExecuteAsync(CommandContext context)
    {
        #region Welcome and setup

        // Display startup banner to establish context and available operations.
        AnsiConsole.Write(new FigletText(ApplicationName).Color(Color.Blue));
        AnsiConsole.MarkupLine($"[dim]{ApplicationDescription}[/]");
        AnsiConsole.MarkupLine($"[dim]{CommandUsageHint}[/]\n");

        #endregion

        #region Interactive command loop

        // Continue processing commands until user explicitly exits.
        // Each iteration handles one complete command with full error recovery.
        while (true)
        {
            // Command prompt start
            AnsiConsole.Markup("[cyan]>[/] ");

            // Read the user input
            var input = ReadLine.Read();

            // Manually ensure we can get back to old commands with arrows
            ReadLine.AddHistory(input);

            // Handle session termination command.
            if (input is "exit")
                break;

            // Process the command with error handling.
            await ProcessCommand(input);
        }

        #endregion

        #region Session completion

        // Provide simple completion feedback.
        AnsiConsole.MarkupLine("[green]Session completed.[/]");
        AnsiConsole.MarkupLine("[dim]Goodbye![/]");

        #endregion

        return 0;
    }

    /// <summary>
    /// Processes a single command input from the user and executes the corresponding operation.
    /// Handles all command parsing, validation, and error recovery to maintain session stability.
    /// </summary>
    /// <param name="input">Raw command string from user input.</param>
    private async Task ProcessCommand(string input)
    {
        try
        {
            // Parse the command into components for operation dispatch.
            var parts = ParseCommand(input);

            // Handle empty input gracefully without error.
            if (parts.Length == 0)
                return;

            // Allow derived classes to handle the parsed command.
            await HandleCommandAsync(parts);
        }
        catch (Exception exception)
        {
            // Log exception details to help with debugging.
            AnsiConsole.MarkupLine($"[red]Error processing command:[/] {Markup.Escape(exception.Message)}");
        }
    }

    /// <summary>
    /// Handles the parsed command components. Derived classes should implement their
    /// specific command dispatch logic here.
    /// </summary>
    /// <param name="commandParts">Array of parsed command components.</param>
    protected abstract Task HandleCommandAsync(string[] commandParts);

    /// <summary>
    /// Parses user input into command components while handling quoted strings.
    /// Supports both quoted and unquoted arguments, preserving spaces within quotes.
    /// This method can be overridden by derived classes if different parsing behavior is needed.
    /// </summary>
    /// <param name="input">Raw command string from user.</param>
    /// <returns>Array of parsed command components.</returns>
    protected virtual string[] ParseCommand(string input)
    {
        // Handle empty or whitespace-only input.
        if (string.IsNullOrWhiteSpace(input))
            return [];

        // Use regex to split on spaces while preserving quoted strings.
        // This allows arguments with spaces to be properly captured.
        var matches = Regex.Matches(input, @"[\""].+?[\""]|[^ ]+");

        // Extract matched values and remove surrounding quotes from quoted strings.
        return [.. matches.Select(match => match.Value.Trim('"'))];
    }

    /// <summary>
    /// Helper method to display help information. Derived classes should override
    /// this method to provide their specific command help.
    /// </summary>
    protected abstract void ShowHelp();

    /// <summary>
    /// Helper method to handle unknown commands with consistent error messaging.
    /// Can be used by derived classes in their command dispatch logic.
    /// </summary>
    /// <param name="unknownCommand">The command that was not recognized.</param>
    protected virtual void HandleUnknownCommand(string unknownCommand)
        // Just log by default
        => AnsiConsole.MarkupLine($"[red]Unknown command: '{Markup.Escape(unknownCommand)}'[/]. Type 'help' for available commands.");
}

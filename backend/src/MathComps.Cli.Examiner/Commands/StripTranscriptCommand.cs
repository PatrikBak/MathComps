using System.ComponentModel;
using MathComps.Infrastructure.Services.Defense;
using Spectre.Console;
using Spectre.Console.Cli;

namespace MathComps.Cli.Examiner.Commands;

/// <summary>
/// Rewinds a fixture's transcript deterministically: keeps the conversation through the N-th <c>## Candidate</c> turn
/// and drops everything after it, so the examiner can re-reply from that point. The default keeps only the opening
/// candidate seed — the reset a re-run starts from after a prompt change.
/// </summary>
[Description("""
    Rewind a fixture's transcript.md: keep the conversation through the N-th '## Candidate' turn and drop everything
    after it, leaving the transcript awaiting the examiner's reply at that point. The default --keep 1 strips back to
    the opening candidate seed.
""")]
public class StripTranscriptCommand : AsyncCommand<StripTranscriptCommand.Settings>
{
    /// <summary>
    /// The command arguments.
    /// </summary>
    public class Settings : CommandSettings
    {
        /// <summary>
        /// The fixture folder whose transcript to rewind.
        /// </summary>
        [CommandArgument(0, "<fixture>")]
        [Description("Path to the fixture folder whose transcript.md to rewind.")]
        public required string Fixture { get; set; }

        /// <summary>
        /// How many candidate turns to keep; the last of them closes the rewound transcript.
        /// </summary>
        [CommandOption("--keep <COUNT>")]
        [Description("How many '## Candidate' turns to keep; the transcript ends with that turn. Defaults to 1 — the opening seed.")]
        [DefaultValue(1)]
        public int Keep { get; set; }
    }

    /// <inheritdoc/>
    public override async Task<int> ExecuteAsync(CommandContext context, Settings commandSettings)
    {
        // At least one candidate turn has to remain for the examiner to reply to.
        if (commandSettings.Keep < 1)
        {
            AnsiConsole.MarkupLine("[red]--keep must be at least 1.[/]");
            return 1;
        }

        // The transcript file within the fixture folder.
        var path = Path.Combine(commandSettings.Fixture, "transcript.md");

        // Bail early when it isn't there.
        if (!File.Exists(path))
        {
            AnsiConsole.MarkupLineInterpolated($"[red]Transcript not found:[/] {path}");
            return 1;
        }

        // Parse the conversation.
        var transcript = Transcript.Parse(await File.ReadAllTextAsync(path));

        // Truncate to the requested candidate turn, surfacing a too-short transcript as a clean CLI error.
        Transcript truncated;
        try
        {
            truncated = transcript.TruncateAfterCandidate(commandSettings.Keep);
        }
        // A too-short transcript is a user error, not a crash — report it plainly and bail.
        catch (InvalidOperationException exception)
        {
            AnsiConsole.MarkupLineInterpolated($"[red]{exception.Message}[/]");
            return 1;
        }

        // Write the rewound transcript back, keeping a trailing newline on the file.
        await File.WriteAllTextAsync(path, truncated.ToMarkdown() + "\n");

        // Report what remained and what was dropped.
        var dropped = transcript.Turns.Length - truncated.Turns.Length;
        AnsiConsole.MarkupLineInterpolated(
            $"Kept {truncated.Turns.Length} turn(s) through candidate turn {commandSettings.Keep}; dropped {dropped}.");

        // Done.
        return 0;
    }
}

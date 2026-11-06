using System.ComponentModel;
using MathComps.Infrastructure.Services.Defense;
using Microsoft.Extensions.Logging;
using Spectre.Console.Cli;

namespace MathComps.Cli.Examiner.Commands;

/// <summary>
/// Rewinds a fixture's transcript deterministically: keeps the conversation through the N-th <c>## Candidate</c> turn
/// and drops everything after it, so the examiner can re-reply from that point. The default keeps only the opening
/// candidate seed, the reset a re-run starts from after a prompt change.
/// </summary>
/// <param name="logger">The logger the outcome and refusals go through.</param>
[Description("""
    Rewind a fixture's transcript.md: keep the conversation through the N-th '## Candidate' turn and drop everything
    after it, leaving the transcript awaiting the examiner's reply at that point. The default --keep 1 strips back to
    the opening candidate seed.
""")]
public class StripTranscriptCommand(ILogger<StripTranscriptCommand> logger)
    : AsyncCommand<StripTranscriptCommand.Settings>
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
        [Description("How many '## Candidate' turns to keep; the transcript ends with that turn, " +
            "and 1 keeps only the opening seed.")]
        [DefaultValue(1)]
        public int Keep { get; set; }
    }

    /// <inheritdoc/>
    public override async Task<int> ExecuteAsync(CommandContext context, Settings commandSettings)
    {
        // At least one candidate turn has to remain for the examiner to reply to.
        if (commandSettings.Keep < 1)
        {
            // Name the bad option.
            logger.LogError("--keep must be at least 1.");

            // The transcript is untouched.
            return 1;
        }

        // The transcript file within the fixture folder.
        var path = Path.Combine(commandSettings.Fixture, "transcript.md");

        // Bail early when the transcript isn't there.
        if (!File.Exists(path))
        {
            // Name the missing transcript.
            logger.LogError("Transcript not found: {Path}", path);

            // Nothing was rewound.
            return 1;
        }

        // Parse the conversation.
        var transcript = Transcript.Parse(await File.ReadAllTextAsync(path));

        // The rewound transcript.
        Transcript truncated;

        // Truncate to the requested candidate turn.
        try
        {
            truncated = transcript.TruncateAfterCandidate(commandSettings.Keep);
        }
        // A too-short transcript is a user error, not a crash.
        catch (InvalidOperationException exception)
        {
            // Say why the transcript can't be rewound that far.
            logger.LogError("{Refusal}", exception.Message);

            // The transcript is untouched.
            return 1;
        }

        // Write the rewound transcript back, keeping a trailing newline on the file.
        await File.WriteAllTextAsync(path, truncated.ToMarkdown() + "\n");

        // How many turns the rewind dropped.
        var dropped = transcript.Turns.Length - truncated.Turns.Length;

        // Report what remained and what was dropped.
        logger.LogInformation("Kept {Kept} turn(s) through candidate turn {Keep}; dropped {Dropped}.",
            truncated.Turns.Length, commandSettings.Keep, dropped);

        // Done.
        return 0;
    }
}

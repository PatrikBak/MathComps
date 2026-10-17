using System.ComponentModel;
using MathComps.Cli.Examiner.Fixtures;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Services.Ai;
using MathComps.Infrastructure.Services.Defense;
using MathComps.Infrastructure.Services.Defense.Engine;
using Spectre.Console;
using Spectre.Console.Cli;

namespace MathComps.Cli.Examiner.Commands;

/// <summary>
/// Judges the reply that closes a fixture's transcript with every guard, without generating anything, and reports each
/// verdict and what the checks cost. The fixture is left as it is.
/// </summary>
/// <param name="examiner">The engine whose guards judge the reply.</param>
[Description("""
    Judge the last examiner reply in a fixture folder's transcript.md with every check, generating nothing. The
    transcript must end on a '## Candidate' turn followed by a non-empty '## Examiner' turn: that last turn is the
    reply judged, and the turns before it are the conversation it answers. The fixture is left unchanged.
""")]
public class ExaminerCheckCommand(IExaminer examiner)
    : AsyncCommand<ExaminerCheckCommand.Settings>
{
    /// <summary>
    /// The command arguments.
    /// </summary>
    public class Settings : CommandSettings
    {
        /// <summary>
        /// The fixture folder holding the reply to judge.
        /// </summary>
        [CommandArgument(0, "<fixture>")]
        [Description("Path to the fixture folder whose last examiner reply to judge.")]
        public required string Fixture { get; set; }
    }

    /// <inheritdoc/>
    public override async Task<int> ExecuteAsync(CommandContext context, Settings commandSettings)
    {
        // The fixture folder holding the reply to judge.
        var folder = commandSettings.Fixture;

        // Bail early when the folder isn't there.
        if (!Directory.Exists(folder))
        {
            AnsiConsole.MarkupLineInterpolated($"[red]Fixture folder not found:[/] {folder}");
            return 1;
        }

        // Load the fixture — problem, reference, transcript.
        var fixture = await Fixture.LoadAsync(folder);

        // The reply judged closes the transcript and answers the candidate turn before it, so anything else has
        // nothing to judge.
        if (fixture.Transcript.Turns is not
                [.., { Role: TranscriptRole.Candidate }, { Role: TranscriptRole.Examiner, Text: var reply }]
            || string.IsNullOrWhiteSpace(reply))
        {
            AnsiConsole.MarkupLine(
                "[red]The transcript must end on a '## Candidate' turn and then the '## Examiner' reply to judge.[/]");
            return 1;
        }

        // The fixture without the reply: the conversation the reply answers.
        var beforeReply = fixture with { Transcript = new Transcript([.. fixture.Transcript.Turns.SkipLast(1)]) };

        // The checks' running spend.
        var usage = new ModelUsageAccumulator();

        // Judge the reply with every guard.
        var attempt = await examiner.CheckReplyAsync(beforeReply, reply, usage);

        // Header for the checks' calls.
        AnsiConsole.MarkupLine("[bold]Checks[/]");

        // What each check's call cost and how long it took.
        AttemptReport.RenderCalls(attempt);

        // Header for the reply.
        AnsiConsole.MarkupLine("\n[bold]Examiner reply[/]");

        // The reply itself — printed plainly since it's arbitrary model text, not markup.
        AnsiConsole.WriteLine(attempt.Reply);

        // Every guard's verdict on the reply.
        AttemptReport.RenderVerdicts(attempt);

        // How long the checks took.
        AnsiConsole.MarkupLineInterpolated(
            $"[grey]Checks took {TimeSpan.FromMilliseconds(attempt.DurationMs).TotalSeconds:0.0}s.[/]");

        // Price the checks from their own tally; one credit is one US dollar.
        AnsiConsole.MarkupLine($"[green]These checks cost ${usage.Accrued.Cost:0.0000}.[/]");

        // Done.
        return 0;
    }
}

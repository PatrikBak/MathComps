using System.ComponentModel;
using MathComps.Infrastructure.BulkImport;
using Spectre.Console;
using Spectre.Console.Cli;
using static Spectre.Console.Markup;

namespace MathComps.Cli.BulkImport.Commands;

/// <summary>
/// The command behind <see cref="IProblemSwapService"/>: it takes the two problem slugs, hands them to the
/// service, and prints where each problem stood, what hangs off it, and the slug it lands on.
/// </summary>
/// <param name="swap">The service that carries the exchange out.</param>
[Description("Exchange two problems' positions, carrying every defense, comment and mark with them.")]
public class SwapCommand(IProblemSwapService swap) : AsyncCommand<SwapCommand.Settings>
{
    /// <summary>
    /// The command arguments.
    /// </summary>
    public class Settings : CommandSettings
    {
        /// <summary>
        /// The slug of one problem to move.
        /// </summary>
        [CommandArgument(0, "<slugA>")]
        [Description("The slug of one problem to move. Example: 75-csmo-a-iii-1")]
        public required string SlugA { get; set; }

        /// <summary>
        /// The slug of the other problem to move.
        /// </summary>
        [CommandArgument(1, "<slugB>")]
        [Description("The slug of the other problem to move. Example: 75-csmo-a-iii-3")]
        public required string SlugB { get; set; }

        /// <summary>
        /// Whether to report what the exchange would do without writing it.
        /// </summary>
        [CommandOption("--dry-run")]
        [Description("Run every check and report what would happen. Writes nothing.")]
        public bool DryRun { get; set; }
    }

    /// <inheritdoc/>
    public override async Task<int> ExecuteAsync(CommandContext context, Settings settings)
    {
        // What the exchange did, or what a dry run says it would do.
        ProblemSwapResult result;

        // The exchange itself, which refuses a pair it cannot carry out.
        try
        {
            // Move the two problems onto each other's positions, or work out what that would do.
            result = await swap.SwapAsync(settings.SlugA, settings.SlugB, settings.DryRun);
        }
        // The pair is the caller's to correct.
        catch (ProblemSwapRefusedException exception)
        {
            // Say what stands in the way, in the words the refusal used.
            AnsiConsole.MarkupLine($"[red]{Escape(exception.Message)}[/]");

            // Nothing was written, here or on the run that refused it.
            return 1;
        }

        // Where each problem stands and what hangs off it, so the weight of the move is visible.
        Render(result, settings.DryRun);

        // The problems have exchanged positions, or a dry run says they would.
        return 0;
    }

    /// <summary>
    /// Writes the exchange to the console: where each problem stood, what hangs off it, and the slugs it lands on.
    /// </summary>
    /// <param name="result">The exchange to render.</param>
    /// <param name="dryRun">Whether the run wrote anything, which decides the closing banner.</param>
    private static void Render(ProblemSwapResult result, bool dryRun)
    {
        // Lead with the pair the rest of the report is about.
        AnsiConsole.MarkupLine(
            $"[bold]Exchanging[/] {Escape(result.First.Slug)} [aqua]<->[/] {Escape(result.Second.Slug)}");

        // Each problem's position and the work hanging off it.
        RenderSide(result.First);
        RenderSide(result.Second);

        // The slugs each problem takes on at the position it lands on.
        AnsiConsole.MarkupLine("\n[bold]New slugs[/]:");
        AnsiConsole.MarkupLine($"  [yellow]{Escape(result.First.Slug)}[/] -> {Escape(result.FirstNewSlug)}");
        AnsiConsole.MarkupLine($"  [yellow]{Escape(result.Second.Slug)}[/] -> {Escape(result.SecondNewSlug)}");

        // A dry run says what it would have done and leaves the database as it found it.
        if (dryRun)
        {
            AnsiConsole.MarkupLine("\n[yellow bold]DRY RUN[/] — nothing was written.");
            return;
        }

        // The closing banner of a performed exchange.
        AnsiConsole.MarkupLine("\n[green bold]SWAPPED[/]");
    }

    /// <summary>
    /// Writes one problem's block: where it sits, and how much of a student's work travels with it.
    /// </summary>
    /// <param name="side">The problem to render.</param>
    private static void RenderSide(ProblemSwapSide side)
    {
        // The problem's heading, naming where it sits.
        AnsiConsole.MarkupLine(
            $"\n[bold]{Escape(side.Slug)}[/]: {Escape(side.CompetitionPath)} · season {side.SeasonYear}"
            + $" · problem {side.Number}");

        // What points at it, and therefore travels with it.
        AnsiConsole.MarkupLine(
            $"  [blue]{side.Defenses} defense(s)[/], [blue]{side.Comments} comment(s)[/], "
            + $"[blue]{side.SelfAssessments} self-assessment(s)[/]");
    }
}

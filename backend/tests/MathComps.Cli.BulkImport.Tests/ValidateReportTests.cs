using MathComps.Cli.BulkImport.Commands;
using MathComps.Cli.BulkImport.Manifest;
using MathComps.Domain.EfCoreEntities;
using MathComps.Domain.Localization;
using MathComps.Infrastructure.Services.BulkImport;
using Spectre.Console;

namespace MathComps.Cli.BulkImport.Tests;

/// <summary>
/// Tests what the dry run's report tells its reader about a draft's DB preview.
/// </summary>
public class ValidateReportTests
{
    /// <summary>
    /// The report names each problem the import would create, with its languages, and each it would update. It names
    /// each text it would rewrite, sums up the texts it would leave as they are, and prints the problem counts apply
    /// would. A text of every kind the preview can classify goes in, so one the report has no line for can't take the
    /// run down.
    /// </summary>
    [Fact]
    public void The_report_lists_creates_updates_and_rewrites_and_counts_the_rest()
    {
        // A text of every kind on problem 1.
        var texts = Enum.GetValues<DraftTextAction>()
            .Select(action => new ProblemTextResolution("74-csmo-a-iii-1", DocumentType.Statement, Language.SK, action))
            .ToArray();

        // Problem 1 updated, 2 left as it is, and 3 created in Slovak and English.
        var preview = new DraftDbPreview(
            Entities: [],
            TextResolutions: [.. texts],
            Problems:
            [
                new ProblemResolution("74-csmo-a-iii-1", ResolutionAction.Update, [Language.SK]),
                new ProblemResolution("74-csmo-a-iii-2", ResolutionAction.Reuse, [Language.SK]),
                new ProblemResolution("74-csmo-a-iii-3", ResolutionAction.Create, [Language.SK, Language.EN])
            ],
            MissingProblemOrders: [], SortOrderChanges: [], Orphans: [], DefendedProblemRestatements: [],
            HostedGroupCountDisagreement: null, MovesProposalsEmbargo: false, OrganizationProblem: null,
            ProposalConflicts: []);

        // The report on the preview.
        var report = RenderReport(new ValidateResult([], preview));

        // The new problem with its languages, the updated one, and the rewritten text with its language.
        Assert.Contains("create problem 74-csmo-a-iii-3 (sk, en)", report);
        Assert.Contains("update problem 74-csmo-a-iii-1", report);
        Assert.Contains("overwrite original 74-csmo-a-iii-1 statement (sk)", report);

        // The two texts left as they are, summed up.
        Assert.Contains("unchanged 2 text(s)", report);

        // The counts apply would print.
        Assert.Contains("Problems: 1 inserted, 1 updated, 1 unchanged", report);
    }

    /// <summary>
    /// Renders a validation result's report into plain text, the way a redirected run would write it.
    /// </summary>
    /// <param name="result">The validation result to report.</param>
    /// <returns>The report's text, without colour.</returns>
    private static string RenderReport(ValidateResult result)
    {
        // The buffer the report goes to.
        var buffer = new StringWriter();

        // The terminal, to hand back afterwards.
        var terminal = AnsiConsole.Console;

        // A plain-text console writing into the buffer. Without the default enrichers, so a CI runner's environment
        // can't turn ANSI back on.
        AnsiConsole.Console = AnsiConsole.Create(new AnsiConsoleSettings
        {
            Ansi = AnsiSupport.No,
            ColorSystem = ColorSystemSupport.NoColors,
            Enrichment = new ProfileEnrichment { UseDefaultEnrichers = false },
            Out = new AnsiConsoleOutput(buffer)
        });

        // Write the report, then hand the terminal back.
        try
        {
            // Render the report for a Slovak draft of the csmo-a-iii 2024 round.
            ValidateReport.Render(
                new ManifestMeta("csmo-a-iii", new ManifestSeason(2024), "2024-03-15", null, null, Language.SK),
                result);
        }
        finally
        {
            // Hand the terminal back.
            AnsiConsole.Console = terminal;
        }

        // What the report wrote.
        return buffer.ToString();
    }
}

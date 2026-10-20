using MathComps.Cli.BulkImport.Commands;
using MathComps.Cli.BulkImport.Manifest;
using MathComps.Domain.EfCoreEntities;
using MathComps.Domain.Localization;
using MathComps.Infrastructure.Services.BulkImport;
using Spectre.Console;

namespace MathComps.Cli.BulkImport.Tests;

/// <summary>
/// Tests what the import's report tells its reader about what the import does to the database. It swaps the
/// console every report writes to, so it shares a collection with every other test writing there.
/// </summary>
[Collection(nameof(AnsiConsole))]
public class ImportReportTests
{
    /// <summary>
    /// The report names each problem the import would create, with its languages, and each it would update. It names
    /// each text it would rewrite and sums up the texts it would leave as they are. A text of every kind the import can
    /// classify goes in, so one the report has no line for can't take the run down. It closes on the verdict line a
    /// script reading the run matches, counting the refused texts' errors, and once nothing is refused it also prints
    /// the problem counts.
    /// </summary>
    [Fact]
    public async Task The_report_lists_creates_updates_and_rewrites_and_counts_the_rest()
    {
        // A text of every kind on problem 1.
        var texts = Enum.GetValues<DraftTextAction>()
            .Select(action => new ProblemTextResolution("74-csmo-a-iii-1", DocumentType.Statement, Language.SK, action))
            .ToArray();

        // Problem 1 updated, 2 left as it is, and 3 created in Slovak and English.
        var findings = new DraftImportFindings(
            Entities: [],
            TextResolutions: [.. texts],
            Problems:
            [
                new ProblemResolution("74-csmo-a-iii-1", ResolutionAction.Update, [Language.SK]),
                new ProblemResolution("74-csmo-a-iii-2", ResolutionAction.Reuse, [Language.SK]),
                new ProblemResolution("74-csmo-a-iii-3", ResolutionAction.Create, [Language.SK, Language.EN])
            ],
            MissingProblemOrders: [], SortOrderChanges: [], HostedGroupCountDisagreement: null,
            HostedEmbargoDisagreement: null, MovesProposalsEmbargo: false, OrganizationProblem: null,
            ProposalConflicts: []);

        // The report on a dry run of the draft.
        var report = RenderReport(await CleanDraftAsync(findings));

        // The new problem with its languages, the updated one, and the rewritten text with its language.
        Assert.Contains("create problem 74-csmo-a-iii-3 (sk, en)", report);
        Assert.Contains("update problem 74-csmo-a-iii-1", report);
        Assert.Contains("overwrite original 74-csmo-a-iii-1 statement (sk)", report);

        // The two texts left as they are, summed up.
        Assert.Contains("unchanged 2 text(s)", report);

        // The three texts the import refuses fail the run, last.
        Assert.EndsWith("FAIL — 3 error(s), 0 warning(s)", report.TrimEnd());

        // The report on the same draft once every text the import refuses is gone.
        var passing = RenderReport(await CleanDraftAsync(
            findings with { TextResolutions = [.. texts.Where(text => !text.IsRefused)] }));

        // The problem counts.
        Assert.Contains("Problems: 1 inserted, 1 updated, 1 unchanged", passing);

        // The verdict, last.
        Assert.EndsWith("PASS — 0 warning(s)", passing.TrimEnd());
    }

    /// <summary>
    /// Builds the result of dry-running a draft clean on its own terms, which the database answered with the given
    /// findings.
    /// </summary>
    /// <param name="findings"><inheritdoc cref="DraftImportFinished.Findings" path="/summary"/></param>
    /// <returns>The folder's result.</returns>
    private static Task<ImportResult> CleanDraftAsync(DraftImportFindings findings) =>
        // No issue of the draft's own, so the import runs
        ImportResult.CheckThenImportAsync([], async () => await FinishedImports.DryRunAsync(findings));

    /// <summary>
    /// Renders a dry run's report into plain text, the way a redirected run would write it.
    /// </summary>
    /// <param name="result">The import result to report.</param>
    /// <returns>The report's text, without colour.</returns>
    private static string RenderReport(ImportResult result)
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
            ImportReport.Render(
                new ManifestMeta("csmo-a-iii", new ManifestSeason(2024), "2024-03-15", null, null, Language.SK),
                result, dryRun: true);
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

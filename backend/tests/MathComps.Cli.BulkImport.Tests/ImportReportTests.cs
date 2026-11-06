using MathComps.Cli.BulkImport.Commands;
using MathComps.Cli.BulkImport.Manifest;
using MathComps.Domain.EfCoreEntities;
using MathComps.Domain.Localization;
using MathComps.Infrastructure.Services.BulkImport;
using Microsoft.Extensions.Logging;

namespace MathComps.Cli.BulkImport.Tests;

/// <summary>
/// Tests what the import's report tells its reader about what the import does to the database.
/// </summary>
public class ImportReportTests
{
    /// <summary>
    /// The report names each taxonomy entity, each problem the import would create, with its languages, and each it
    /// would update. It names each text it would rewrite and sums up the texts it would leave as they are. A text of
    /// every kind the import can classify goes in, so one the report has no line for can't take the run down. Each
    /// refused text gets an error line naming its rule, and the report closes on a verdict line logged as an error,
    /// counting them. Once nothing is refused it says so and logs the problem counts.
    /// </summary>
    [Fact]
    public async Task The_report_lists_creates_updates_and_rewrites_and_counts_the_rest()
    {
        // A text of every kind on problem 1.
        var texts = Enum.GetValues<DraftTextAction>()
            .Select(action => new ProblemTextResolution("74-csmo-a-iii-1", DocumentType.Statement, Language.SK, action))
            .ToArray();

        // The competition reused, problem 1 updated, 2 left as it is, and 3 created in Slovak and English.
        var findings = new DraftImportFindings(
            Entities: [new EntityResolution("competition", "csmo-a-iii", ResolutionAction.Reuse)],
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

        // The report's lines, as logged.
        var lines = report.Select(record => record.Message).ToList();

        // The competition, the new problem with its languages, the updated one, and the rewritten text with its
        // language.
        Assert.Contains("  reuse competition csmo-a-iii", lines);
        Assert.Contains("  create problem 74-csmo-a-iii-3 (sk, en)", lines);
        Assert.Contains("  update problem 74-csmo-a-iii-1", lines);
        Assert.Contains("  overwrite original 74-csmo-a-iii-1 statement (sk)", lines);

        // The two texts left as they are, summed up.
        Assert.Contains("  unchanged 2 text(s)", lines);

        // The lines for the texts the import refuses.
        var refusals = report
            .Where(record => record.Message.StartsWith("  error (", StringComparison.Ordinal))
            .ToList();

        // One error line per refused text, each naming its rule.
        Assert.Equal(3, refusals.Count);
        Assert.All(refusals, record => Assert.Equal(LogLevel.Error, record.Level));

        // The verdict, last: a fail counting the three refusals, logged as an error.
        Assert.Equal(("FAIL — 3 error(s), 0 warning(s)", LogLevel.Error), (report[^1].Message, report[^1].Level));

        // The report on the same draft once every text the import refuses is gone.
        var passing = RenderReport(await CleanDraftAsync(
            findings with { TextResolutions = [.. texts.Where(text => !text.IsRefused)] }));

        // No issue left, and the problem counts.
        Assert.Contains(passing, record => record.Message == "No issues.");
        Assert.Contains(passing, record => record.Message == "Problems: 1 inserted, 1 updated, 1 unchanged");

        // The verdict, last.
        Assert.Equal(("PASS — 0 warning(s)", LogLevel.Information), (passing[^1].Message, passing[^1].Level));
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
    /// Logs a dry run's report into a recording logger and hands back what it recorded.
    /// </summary>
    /// <param name="result">The import result to report.</param>
    /// <returns>The report's lines, in the order they were logged.</returns>
    private static IReadOnlyList<LoggedLine> RenderReport(ImportResult result)
    {
        // The logger the report goes to.
        var logger = new RecordingLogger();

        // Log the report for a Slovak draft of the csmo-a-iii 2024 round.
        ImportReport.Render(
            logger,
            new ManifestMeta("csmo-a-iii", new ManifestSeason(2024), "2024-03-15", null, null, Language.SK),
            result, dryRun: true);

        // What the report logged.
        return logger.Lines;
    }

    /// <summary>
    /// One line a logger was handed.
    /// </summary>
    /// <param name="Level">The line's level.</param>
    /// <param name="Message">The line's text, its template filled in.</param>
    private sealed record LoggedLine(LogLevel Level, string Message);

    /// <summary>
    /// A logger keeping every line it is handed, at every level. The Microsoft.Extensions.Diagnostics.Testing fake
    /// needs newer Microsoft.Extensions packages than the CLI projects pin.
    /// </summary>
    private sealed class RecordingLogger : ILogger
    {
        /// <summary>
        /// Every line logged so far, in order.
        /// </summary>
        public List<LoggedLine> Lines { get; } = [];

        /// <inheritdoc/>
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

        /// <inheritdoc/>
        public bool IsEnabled(LogLevel logLevel) => true;

        /// <inheritdoc/>
        public void Log<TState>(
            LogLevel logLevel,
            EventId eventId,
            TState state,
            Exception? exception,
            Func<TState, Exception?, string> formatter) =>
            // Keep the line with its template filled in
            Lines.Add(new LoggedLine(logLevel, formatter(state, exception)));
    }
}

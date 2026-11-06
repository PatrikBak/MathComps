using MathComps.Cli.BulkImport.Manifest;
using MathComps.Cli.BulkImport.Validation;
using MathComps.Infrastructure.Services.BulkImport;
using MathComps.Shared.Extensions;
using Microsoft.Extensions.Logging;

namespace MathComps.Cli.BulkImport.Commands;

/// <summary>
/// Logs an <see cref="ImportResult"/> as a human-readable report: the taxonomy being imported, what the import does to
/// the database, the issues grouped by file, the problem counts and uploaded figures of a passing import, and a final
/// verdict line.
/// </summary>
public static class ImportReport
{
    /// <summary>
    /// Logs the full report.
    /// </summary>
    /// <param name="logger">The logger the report's lines go through.</param>
    /// <param name="meta">The draft's folder-level taxonomy.</param>
    /// <param name="result">The import's result.</param>
    /// <param name="dryRun">Whether the import was a dry run, keeping nothing whatever it found.</param>
    public static void Render(ILogger logger, ManifestMeta meta, ImportResult result, bool dryRun)
    {
        // The draft's language, lower-cased.
        var language = meta.Language.ToString().ToLowerInvariant();

        // The heading's lead word, dry run or real.
        var heading = dryRun ? "Dry run of" : "Importing";

        // Lead with what's being imported, the competition the rest of the report is about.
        logger.LogInformation("{Heading} {Competition} · season {Season} · {Language}",
            heading, meta.CompetitionPath, meta.Season.Year, language);

        // What the import does to the database, or why it never got that far.
        switch (result.Outcome)
        {
            // The draft failed its own checks, so the database was never asked
            case null:
                logger.LogWarning("Database not consulted until the errors below are fixed.");
                break;

            // A stored row the registry can't place stopped the import before it checked anything else
            case DraftImportStoppedAtOrphans:
                logger.LogWarning("Database checks stopped at the rows below, before anything else.");
                break;

            // What an import going through the whole draft did, or would have done
            case DraftImportFinished finished:
                RenderFindings(logger, finished.Findings);
                break;

            // Unhandled cases
            default:
                throw new ArgumentOutOfRangeException(nameof(result), result.Outcome, "Unknown import outcome.");
        }

        // The draft's own issues and every reason the database refused it, in display order.
        var issues = result.DraftIssues
            .Concat(result.Outcome is { } outcome ? ImportIssues.From(outcome, meta.Organization) : [])
            .InDisplayOrder();

        // The issues, by file.
        RenderIssues(logger, issues);

        // For a passing draft, the problem counts.
        if (result is { Ok: true, Outcome: DraftImportFinished passed })
            RenderProblemCounts(logger, passed.Findings.Problems);

        // The figures an import that landed pushed.
        if (result.Outcome is DraftImportFinished { Uploads: { } uploads })
        {
            // The line counting the skipped figures too, when some were unchanged.
            if (uploads.Skipped > 0)
                logger.LogInformation("Images: {Uploaded} uploaded, {Skipped} skipped",
                    uploads.Uploaded, uploads.Skipped);

            // Otherwise the line counting only the uploads.
            else
                logger.LogInformation("Images: {Uploaded} uploaded", uploads.Uploaded);
        }

        // The issues' error and warning tallies.
        var errorCount = issues.Count(issue => issue.Severity == VerdictSeverity.Error);
        var warningCount = issues.Count(issue => issue.Severity == VerdictSeverity.Warning);

        // The verdict line: a pass, or an import on a real run, when nothing blocked the folder.
        if (result.Ok)
            logger.LogInformation("{Verdict} — {Warnings} warning(s)", dryRun ? "PASS" : "IMPORTED", warningCount);

        // A fail otherwise, on a dry run.
        else if (dryRun)
            logger.LogError("FAIL — {Errors} error(s), {Warnings} warning(s)", errorCount, warningCount);

        // A failed real run says it kept nothing, since a database block above can list what it would have written.
        else
            logger.LogError("FAIL — {Errors} error(s), {Warnings} warning(s), nothing imported",
                errorCount, warningCount);
    }

    /// <summary>
    /// Logs what the import does to the database: the taxonomy, every problem it creates or updates, every text it
    /// adds, overwrites or refuses on an existing problem, a count of the texts it leaves unchanged, and the
    /// re-sequencing.
    /// </summary>
    /// <param name="logger">The logger the database block's lines go through.</param>
    /// <param name="findings"><inheritdoc cref="DraftImportFinished.Findings" path="/summary"/></param>
    private static void RenderFindings(ILogger logger, DraftImportFindings findings)
    {
        // Header for the database block.
        logger.LogInformation("Database:");

        // One line per taxonomy entity, naming what the import does to it.
        foreach (var entity in findings.Entities)
        {
            // The entity's action, lower-cased as everywhere else in the report.
            var action = entity.Action.ToString().ToLowerInvariant();

            // The entity's line.
            logger.LogInformation("  {Action} {Kind} {Identifier}", action, entity.EntityKind, entity.Identifier);
        }

        // One line per problem the import creates or updates, a new one naming the languages it is written in.
        foreach (var problem in findings.Problems)
        {
            // The problem's languages, lower-cased.
            var languages = problem.Languages.Select(language => language.ToString().ToLowerInvariant());

            // The problem's line, or none for one the import leaves as it is.
            switch (problem.Action)
            {
                // A new problem's line, naming its languages
                case ResolutionAction.Create:
                    logger.LogInformation("  create problem {Slug} ({Languages})",
                        problem.Slug, languages.ToJoinedString());
                    break;

                // An updated problem's line
                case ResolutionAction.Update:
                    logger.LogInformation("  update problem {Slug}", problem.Slug);
                    break;

                // A problem the import leaves as it is gets no line
                case ResolutionAction.Reuse:
                    break;

                // Unhandled cases
                default:
                    throw new ArgumentOutOfRangeException(nameof(findings), problem.Action, "Unknown problem action.");
            }
        }

        // One line per text of an existing problem that the import adds, overwrites or refuses.
        foreach (var resolution in findings.TextResolutions)
        {
            // A text listed elsewhere, or only counted, has no line of its own.
            if (LineFor(resolution.Action) is not { } line)
                continue;

            // The half the text lands on and its language, lower-cased.
            var half = resolution.DocumentType.ToString().ToLowerInvariant();
            var language = resolution.Language.ToString().ToLowerInvariant();

            // Log the text's line: its slug, half and language.
            logger.Log(line.Level, "  {Action} {Slug} {Half} ({Language})",
                line.Label, resolution.Slug, half, language);
        }

        // The texts a re-import leaves as they are, in one count.
        var unchanged = findings.TextResolutions.Count(resolution => resolution.Action
            is DraftTextAction.UnchangedOriginal or DraftTextAction.UnchangedTranslation);

        // Log the unchanged texts' count, when there are any.
        if (unchanged > 0)
            logger.LogInformation("  unchanged {Count} text(s)", unchanged);

        // The sort-order reconciliation the import performs to match the registry, informational and never blocking.
        foreach (var change in findings.SortOrderChanges)
            logger.LogInformation("  re-sequence {Path} {FromOrder}→{ToOrder}",
                change.Path, change.FromOrder, change.ToOrder);
    }

    /// <summary>
    /// Logs the line tallying the problems an import inserts, updates and leaves unchanged.
    /// </summary>
    /// <param name="logger">The logger the line goes through.</param>
    /// <param name="problems">What the import does to each problem.</param>
    private static void RenderProblemCounts(ILogger logger, IReadOnlyList<ProblemResolution> problems)
    {
        // Each action's tally.
        var inserted = problems.Count(problem => problem.Action == ResolutionAction.Create);
        var updated = problems.Count(problem => problem.Action == ResolutionAction.Update);
        var unchanged = problems.Count(problem => problem.Action == ResolutionAction.Reuse);

        // The tally's line.
        logger.LogInformation("Problems: {Inserted} inserted, {Updated} updated, {Unchanged} unchanged",
            inserted, updated, unchanged);
    }

    /// <summary>
    /// The label and level of a text's own line in the database block: a refused second original logs as a warning,
    /// an in-place overwrite and a clean add as information. An unchanged text gets none, since the block counts those
    /// instead, and neither does a create the import refuses, which the issues report.
    /// </summary>
    /// <param name="action">The resolution action.</param>
    /// <returns>The label and the level, or null when the text gets no line.</returns>
    private static (string Label, LogLevel Level)? LineFor(DraftTextAction action) => action switch
    {
        DraftTextAction.AddOriginal => ("add original", LogLevel.Information),
        DraftTextAction.OverwriteOriginal => ("overwrite original", LogLevel.Information),
        DraftTextAction.SecondOriginal => ("second original", LogLevel.Warning),
        DraftTextAction.AddTranslation => ("add translation", LogLevel.Information),
        DraftTextAction.OverwriteTranslation => ("overwrite translation", LogLevel.Information),
        DraftTextAction.UnchangedOriginal or DraftTextAction.UnchangedTranslation
            or DraftTextAction.NoOriginalForNewProblem or DraftTextAction.NewProblemMissingMetadata => null,
        _ => throw new ArgumentOutOfRangeException(nameof(action), action, "Unknown text action.")
    };

    /// <summary>
    /// Logs every issue, grouped by file, each tagged with its severity, position and rule and logged at its severity.
    /// </summary>
    /// <param name="logger">The logger the issues go through.</param>
    /// <param name="issues">The issues to log, already in display order.</param>
    private static void RenderIssues(ILogger logger, IReadOnlyList<VerdictError> issues)
    {
        // A clean draft gets one line saying so.
        if (issues.Count == 0)
        {
            // Say there are no issues.
            logger.LogInformation("No issues.");

            // Nothing else to log.
            return;
        }

        // Group by file so all of one file's issues sit together under one heading.
        foreach (var fileGroup in issues.GroupBy(issue => issue.File))
        {
            // File heading.
            logger.LogInformation("{File}", fileGroup.Key);

            // Each of the file's issues, under its heading.
            foreach (var issue in fileGroup)
            {
                // The half and line:col coordinates, when the issue carries them.
                var half = issue.Half is { } problemHalf ? $" {problemHalf.ToString().ToLowerInvariant()}" : "";
                var position = issue.Line is { } line ? $" {line}:{issue.Col?.ToString() ?? "?"}" : "";

                // The severity tag with its location.
                var location = $"{issue.Severity.ToString().ToLowerInvariant()}{half}{position}";

                // The issue's level: an error blocks the import, a warning only advises.
                var level = issue.Severity switch
                {
                    VerdictSeverity.Error => LogLevel.Error,
                    VerdictSeverity.Warning => LogLevel.Warning,
                    _ => throw new ArgumentOutOfRangeException(nameof(issues), issue.Severity, "Unknown severity.")
                };

                // The issue's line: its location, then the rule and message.
                logger.Log(level, "  {Location} ({Rule}) {Message}", location, issue.Rule, issue.Message);
            }
        }
    }
}

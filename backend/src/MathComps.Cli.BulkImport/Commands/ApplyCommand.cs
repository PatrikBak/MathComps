using System.ComponentModel;
using System.Globalization;
using MathComps.Cli.BulkImport.Validation;
using MathComps.Infrastructure.BulkImport;
using Spectre.Console.Cli;

namespace MathComps.Cli.BulkImport.Commands;

/// <summary>
/// The import command for the bulk-import pipeline: it runs the same <see cref="DraftValidationPipeline"/> the
/// dry-run does, and only when that comes back clean does it perform the real changes — upload images, rewrite
/// refs, and upsert the taxonomy and <c>Problem</c> / <c>ProblemText</c> / author rows. Running the validation
/// first is what makes a green <c>validate</c> all but guarantee a green <c>apply</c>: it's the very same check.
/// </summary>
/// <param name="pipeline">The shared read-only validation pipeline.</param>
/// <param name="apply">The mutating apply service — the single source of truth for what the import wrote and
/// uploaded.</param>
[Description("Import a draft folder: validate, then upload images and write the rows. Mutates the database.")]
public class ApplyCommand(DraftValidationPipeline pipeline, IDraftApplyService apply)
    : AsyncCommand<ApplyCommand.Settings>
{
    /// <summary>
    /// The command arguments.
    /// </summary>
    public class Settings : CommandSettings
    {
        /// <summary>
        /// Paths and/or globs selecting the draft folder(s) to import.
        /// </summary>
        [CommandArgument(0, "<folders>")]
        [Description("Draft folder path(s) or glob(s) to import. Example: ./my-draft OR 'data/problems/skmo-2025-*'")]
        public required string[] Folders { get; set; }
    }

    /// <inheritdoc/>
    public override async Task<int> ExecuteAsync(CommandContext context, Settings settings) =>
        // Import every matched folder; the runner owns the glob expansion, per-folder header and tally.
        await MultiFolderRunner.RunAsync(
            settings.Folders, okLabel: "applied", failLabel: "failed",
            ApplyFolderAsync);

    /// <summary>
    /// Validates then imports a single draft folder, rendering its report. Validation runs first — apply never
    /// mutates a draft it hasn't checked — so a folder that fails validation writes nothing.
    /// </summary>
    /// <param name="folder">The draft-folder path to import.</param>
    /// <returns>Whether the folder was imported — false when validation failed and it was skipped.</returns>
    private async Task<bool> ApplyFolderAsync(string folder)
    {
        // Validate first with the shared pipeline — apply never mutates a draft it hasn't checked.
        var outcome = await pipeline.RunAsync(folder);

        // Abort this folder on any error: surface the issues exactly as validate would, and write nothing.
        if (!outcome.Result.Ok)
        {
            // Render the issues.
            ValidateReport.Render(outcome.Manifest.Meta, outcome.Result);

            // This folder failed validation — nothing written.
            return false;
        }

        // A passing validation always carries a preview — the run aborts above whenever one couldn't be produced
        // (an unusable taxonomy or an unreachable DB both fail the verdict). So a null here is an invariant
        // violation, not a user error: refuse to write blind and fail this folder loudly.
        if (outcome.Result.DbPreview is null)
            throw new InvalidOperationException(
                "Refusing to apply without a DB preview — a clean validation must produce one. This is a bug.");

        // The folder's taxonomy from the manifest.
        var meta = outcome.Manifest.Meta;

        // Build the apply target from that taxonomy.
        var target = new DraftTarget(meta.CompetitionPath, meta.Season.Year);

        // The folder date is a validated YYYY-MM-DD; parse it for the round.
        var date = DateOnly.ParseExact(meta.Date, "yyyy-MM-dd", CultureInfo.InvariantCulture);

        // The embargo instant, when the folder names one; absent means the round opens as soon as it lands.
        // Read as UTC whatever offset the folder wrote it in, for the reason HostedGroupService.DeclareAsync
        // spells out.
        var visibleSince = meta.VisibleSince is null
            ? (DateTimeOffset?)null
            : DateTimeOffset
                .Parse(meta.VisibleSince, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind)
                .ToUniversalTime();

        // Each problem's full content — authors, link, per-language bodies, images.
        var problems = outcome.Manifest.Problems
            .Select(problem => new DraftProblemContent(
                problem.Order,
                problem.HasSidecar,
                problem.Authors,
                problem.SolutionLink,
                problem.Tags,
                [.. problem.Texts.Select(text => new DraftTextContent(
                    text.Language, text.Original, text.StatementMarkdown, text.SolutionMarkdown))],
                problem.Images))
            .ToList();

        // The image refs resolve against the draft folder; use its absolute path.
        var folderPath = Path.GetFullPath(folder);

        // Validation passed — perform the import.
        var appliedOutcome = await apply.ApplyAsync(target, date, visibleSince, problems, folderPath);

        // Pair the apply outcome with the warning-only issues the run proceeded past.
        var result = new ApplyResult(appliedOutcome, outcome.Result.Issues);

        // Render the report.
        ApplyReport.Render(meta, result);

        // A completed import.
        return true;
    }
}

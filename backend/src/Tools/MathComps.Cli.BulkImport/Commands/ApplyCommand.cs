using System.ComponentModel;
using System.Globalization;
using MathComps.Cli.BulkImport.Validation;
using MathComps.Infrastructure.BulkImport;
using MathComps.Shared;
using Spectre.Console;
using Spectre.Console.Cli;

namespace MathComps.Cli.BulkImport.Commands;

/// <summary>
/// The import command for the bulk-import pipeline: it runs the same <see cref="DraftValidationPipeline"/> the
/// dry-run does, and only when that comes back clean does it perform the real changes — upload images, rewrite
/// refs, and upsert the taxonomy and <c>Problem</c> / <c>ProblemText</c> / author rows. Running the validation
/// first is what makes a green <c>validate</c> all but guarantee a green <c>apply</c>: it's the very same check.
/// </summary>
/// <param name="pipeline">The shared read-only validation pipeline.</param>
/// <param name="apply">The mutating apply service.</param>
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
        /// Path to the draft folder to import.
        /// </summary>
        [CommandArgument(0, "<folder>")]
        [Description("Path to the draft folder to import.")]
        public required string Folder { get; set; }

        /// <summary>
        /// Emit the structured result as JSON instead of the human-readable report.
        /// </summary>
        [CommandOption("--json")]
        [Description("Emit the structured result as JSON instead of a human-readable report.")]
        public bool Json { get; set; }
    }

    /// <inheritdoc/>
    public override async Task<int> ExecuteAsync(CommandContext context, Settings settings)
    {
        // Validate first with the shared pipeline — apply never mutates a draft it hasn't checked.
        var outcome = await pipeline.RunAsync(settings.Folder);

        // Abort on any error: render the issues exactly as validate would, and write nothing.
        if (!outcome.Result.Ok)
        {
            if (settings.Json)
                Console.WriteLine(outcome.Result.ToJson());
            else
                ValidateReport.Render(outcome.Manifest.Meta, outcome.Result);

            return 1;
        }

        // Apply needs a live database. Validate degrades an unreachable DB to a warning (a null preview), which
        // passes the dry run but must block here — we won't start writing only to crash mid-way.
        if (outcome.Result.DbPreview is null)
        {
            AnsiConsole.MarkupLine(
                "[red]Cannot apply:[/] the database preview was skipped (unreachable DB). "
                + "Apply needs a live database connection.");

            return 1;
        }

        // Map the manifest onto the apply contract and perform the import.
        var meta = outcome.Manifest.Meta;
        var target = new DraftTarget(meta.Competition, meta.Category, meta.Round, meta.Season.Year);

        // The folder date is a validated YYYY-MM-DD; parse it for the round-instance.
        var date = DateOnly.ParseExact(meta.Date, "yyyy-MM-dd", CultureInfo.InvariantCulture);

        // Each problem's full content — authors, link, per-language bodies, images.
        var problems = outcome.Manifest.Problems
            .Select(problem => new DraftProblemContent(
                problem.Order,
                problem.Authors,
                problem.SolutionLink,
                [.. problem.Texts.Select(text => new DraftTextContent(
                    text.Language, text.Original, text.StatementMarkdown, text.SolutionMarkdown))],
                problem.Images))
            .ToList();

        // The image refs resolve against the draft folder; use its absolute path.
        var folder = Path.GetFullPath(settings.Folder);

        // Perform the write.
        var applied = await apply.ApplyAsync(target, date, problems, folder);

        // Carry the (warning-only) issues through so the report shows the overwrites the run proceeded past.
        var result = new ApplyResult(applied, outcome.Result.Issues);

        // Emit machine-readable JSON, or the human report by default.
        if (settings.Json)
            Console.WriteLine(result.ToJson());
        else
            ApplyReport.Render(meta, result);

        // A completed import.
        return 0;
    }
}

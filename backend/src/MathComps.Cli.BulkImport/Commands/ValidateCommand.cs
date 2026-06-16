using System.ComponentModel;
using MathComps.Cli.BulkImport.Validation;
using Spectre.Console.Cli;

namespace MathComps.Cli.BulkImport.Commands;

/// <summary>
/// The dry-run command for the bulk-import pipeline: it checks a draft folder and reports every problem at once
/// without changing anything. It runs the shared <see cref="DraftValidationPipeline"/> — the TS preflight plus the
/// C# registry-link and read-only DB-preview checks — and renders the aggregated result. Writes nothing; the
/// separate <c>apply</c> command performs the real changes, running the same pipeline first, so a clean dry run
/// all but guarantees a clean import.
/// </summary>
/// <param name="pipeline">The shared read-only validation pipeline.</param>
[Description("Dry-run a draft folder: TS preflight + registry-link + read-only DB preview. Writes nothing.")]
public class ValidateCommand(DraftValidationPipeline pipeline)
    : AsyncCommand<ValidateCommand.Settings>
{
    /// <summary>
    /// The command arguments.
    /// </summary>
    public class Settings : CommandSettings
    {
        /// <summary>
        /// Paths and/or globs selecting the draft folder(s) to validate.
        /// </summary>
        [CommandArgument(0, "<folders>")]
        [Description("Draft folder path(s) or glob(s) to validate. Example: ./my-draft OR 'data/problems/skmo-2025-*'")]
        public required string[] Folders { get; set; }
    }

    /// <inheritdoc/>
    public override async Task<int> ExecuteAsync(CommandContext context, Settings settings) =>
        // Validate every matched folder; the runner owns the glob expansion, per-folder header and tally.
        await MultiFolderRunner.RunAsync(
            settings.Folders, okLabel: "passed", failLabel: "failed",
            async folder =>
            {
                // Run the shared pipeline — preflight, registry-link, read-only DB preview, all issues aggregated.
                var outcome = await pipeline.RunAsync(folder);

                // Render the report.
                ValidateReport.Render(outcome.Manifest.Meta, outcome.Result);

                // The folder passes when no error-severity issue surfaced.
                return outcome.Result.Ok;
            });
}

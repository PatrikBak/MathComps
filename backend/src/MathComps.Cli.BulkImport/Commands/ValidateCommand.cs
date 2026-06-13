using System.ComponentModel;
using MathComps.Cli.BulkImport.Validation;
using MathComps.Shared;
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
        /// Path to the draft folder to validate.
        /// </summary>
        [CommandArgument(0, "<folder>")]
        [Description("Path to the draft folder to validate.")]
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
        // Run the shared pipeline — preflight, registry-link, read-only DB preview, all issues aggregated.
        var outcome = await pipeline.RunAsync(settings.Folder);

        // Emit machine-readable JSON, or the human report by default.
        if (settings.Json)
            Console.WriteLine(outcome.Result.ToJson());
        else
            ValidateReport.Render(outcome.Manifest.Meta, outcome.Result);

        // Non-zero exit iff an error-severity issue exists.
        return outcome.Result.Ok ? 0 : 1;
    }
}
